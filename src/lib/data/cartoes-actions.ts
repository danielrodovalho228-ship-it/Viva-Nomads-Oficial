"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/utils";
import {
  codigoAtivo,
  chaveServidor,
  garantirCartao,
  pacoteDeCompartilhar,
  registrarMetrica,
  trocarCodigo,
  cartaoPeloCurto,
  type PacoteDeCompartilhar,
} from "@/lib/data/cartoes-servidor";
import { curtoValido, estadiaTerminou, lerRef, REF_COOKIE, REF_DIAS, valorCookieRef } from "@/lib/cartoes/compartilhar";

type Res<T> = { ok: true; valor: T } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  return user && admin ? { supabase, admin, user } : null;
}

/** Cartão do anúncio (T2): só o dono, só anúncio publicado. Cria na 1ª vez (anúncios publicados antes desta versão). */
export async function meuCartaoDoAnuncio(propertyId: string): Promise<Res<PacoteDeCompartilhar>> {
  if (!UUID_RE.test(String(propertyId))) return { ok: false, error: "Imóvel inválido." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta." };
  const { data: p } = await s.admin.from("properties").select("owner_id, status").eq("id", propertyId).maybeSingle();
  if (!p || p.owner_id !== s.user.id) return { ok: false, error: "Imóvel não encontrado." };
  if (p.status !== "active") return { ok: false, error: "O cartão aparece quando o anúncio está publicado." };
  const c = await garantirCartao(s.admin, { tipo: "ownercard", usuarioId: s.user.id, propertyId });
  if (!c) return { ok: false, error: "Não foi possível gerar o cartão agora. Tente de novo." };
  return { ok: true, valor: await pacoteDeCompartilhar(s.admin, c) };
}

/** Cartão-postal (T1): só o morador do contrato, só depois da saída. */
export async function meuCartaoPostal(contratoId: string): Promise<Res<PacoteDeCompartilhar>> {
  if (!UUID_RE.test(String(contratoId))) return { ok: false, error: "Contrato inválido." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta." };
  const { data: c } = await s.admin
    .from("contratos")
    .select("id, tenant_id, property_id, status, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(fim)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c || c.tenant_id !== s.user.id) return { ok: false, error: "Contrato não encontrado." };
  const fins = ((c.contrato_blocos ?? []) as { fim: string | null }[]).map((b) => b.fim).filter((f): f is string => !!f).sort();
  const terminou = estadiaTerminou(
    { status: String(c.status), assinadoProprietarioEm: c.assinado_proprietario_em as string | null, assinadoInquilinoEm: c.assinado_inquilino_em as string | null, fimUltimoBloco: fins.at(-1) ?? null },
    hojeBR(),
  );
  if (!terminou) return { ok: false, error: "O cartão-postal aparece depois da saída." };
  const cartao = await garantirCartao(s.admin, { tipo: "poststay", usuarioId: s.user.id, propertyId: c.property_id as string, contratoId });
  if (!cartao) return { ok: false, error: "Não foi possível gerar o cartão agora. Tente de novo." };
  return { ok: true, valor: await pacoteDeCompartilhar(s.admin, cartao) };
}

/** Opt-in do primeiro nome no cartão-postal (o único campo que a pessoa escolhe). */
export async function definirNomeNoCartao(curto: string, mostrar: boolean): Promise<Res<PacoteDeCompartilhar>> {
  if (!curtoValido(curto)) return { ok: false, error: "Cartão inválido." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta." };
  const cartao = await cartaoPeloCurto(s.admin, curto);
  if (!cartao || cartao.usuario_id !== s.user.id || cartao.tipo !== "poststay") return { ok: false, error: "Cartão não encontrado." };
  const { error } = await s.admin.from("cartoes_compartilhaveis").update({ mostrar_nome: mostrar === true }).eq("id", cartao.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  return { ok: true, valor: await pacoteDeCompartilhar(s.admin, { ...cartao, mostrar_nome: mostrar === true }) };
}

/** Toque em "Compartilhar" (WhatsApp, compartilhar do aparelho, baixar ou copiar o link): conta cards_shared. */
export async function registrarCompartilhamento(curto: string, canal: "whatsapp" | "sistema" | "baixar" | "copiar"): Promise<{ ok: boolean }> {
  if (!curtoValido(curto) || !["whatsapp", "sistema", "baixar", "copiar"].includes(canal)) return { ok: false };
  const s = await sessao();
  if (!s) return { ok: false };
  const cartao = await cartaoPeloCurto(s.admin, curto);
  if (!cartao || cartao.usuario_id !== s.user.id) return { ok: false };
  await registrarMetrica(s.admin, "cards_shared", { cartaoTipo: cartao.tipo, imovelId: cartao.property_id, usuarioId: s.user.id, meio: canal });
  await s.admin.from("cartoes_compartilhaveis").update({ compartilhado_em: new Date().toISOString() }).eq("id", cartao.id);
  return { ok: true };
}

/** Troca o código da conta: o QR e o link antigos param de atribuir; os cartões passam a usar o código novo. */
export async function trocarMeuCodigo(): Promise<Res<string>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre na sua conta." };
  return { ok: true, valor: await trocarCodigo(s.admin, s.user.id) };
}

/**
 * Visita à página do imóvel vinda de um cartão (QR ou link). Sem login. Só atribui com assinatura certa e código
 * ativo de OUTRA conta: conta qr_scans (QR) e ref_listing_views, e guarda a atribuição por 30 dias (cookie) para a
 * candidatura. Parâmetro adulterado → nada é contado nem guardado (a página abre normalmente).
 */
export async function registrarVisitaComRef(listingId: string, parametros: Record<string, string>): Promise<{ atribuida: boolean }> {
  if (!UUID_RE.test(String(listingId))) return { atribuida: false };
  const admin = createAdminClient();
  if (!admin) return { atribuida: false };
  const p = lerRef(chaveServidor(), listingId, parametros ?? {});
  if (!p) return { atribuida: false };
  const dono = await codigoAtivo(admin, p.ref);
  if (!dono) return { atribuida: false };
  const supabase = await createClient();
  const visitante = supabase ? (await supabase.auth.getUser()).data.user?.id ?? null : null;
  if (visitante && visitante === dono.usuarioId) return { atribuida: false }; // a própria pessoa conferindo o cartão
  // Mesma visita repetida (recarregar a página) não conta de novo neste aparelho.
  const jar = await cookies();
  if (jar.get(REF_COOKIE)?.value === valorCookieRef(p)) return { atribuida: true };
  if (p.meio === "qr") await registrarMetrica(admin, "qr_scans", { cartaoTipo: p.tipo, imovelId: listingId, usuarioId: visitante, meio: "qr" });
  await registrarMetrica(admin, "ref_listing_views", { cartaoTipo: p.tipo, imovelId: listingId, usuarioId: visitante, meio: p.meio });
  jar.set(REF_COOKIE, valorCookieRef(p), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: REF_DIAS * 86_400, path: "/" });
  return { atribuida: true };
}
