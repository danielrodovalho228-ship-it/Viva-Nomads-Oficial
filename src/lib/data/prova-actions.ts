"use server";

/*
  FOTO-NA-HORA-B — ações da prova feita na hora (itens de nível, Conforto/Premium):
  • abrirCapturaProva: ao abrir a câmera, o servidor emite o token de captura (anúncio, item, dono; 10 min; uso único).
  • pedirLinkCelular: no computador, "Fotografar pelo celular" → link de uso único (30 min, ligado ao dono) em QR, na
    tela e por e-mail. O link abre a mesma tela de prova no celular, já logado como o dono (rota /prova/celular).
  • provaDoItem: o computador pergunta se a foto da câmera já chegou (o item se atualiza sozinho).
  Só o hash dos tokens vai ao banco. Toda gravação pelo cliente de serviço DEPOIS de conferir o dono.
*/
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { DOMINIOS_PROPRIOS } from "@/lib/cartoes/compartilhar";
import { ehChaveNivel, itemNivel } from "@/config/niveis";
import { LINK_CELULAR_MINUTOS, TOKEN_CAPTURA_MINUTOS, caminhoLinkCelular, type OrigemFoto } from "@/lib/niveis/prova-camera";
import { novoToken } from "@/lib/niveis/prova-servidor";
import type { StatusFoto } from "@/lib/niveis/regras";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Res<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

async function donoDoItem(propertyId: string, chave: string) {
  if (!UUID.test(propertyId ?? "") || !ehChaveNivel(chave) || itemNivel(chave).prova !== "foto") return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id === user.id ? { uid: user.id, email: user.email ?? null, admin } : null;
}

/** Abriu a câmera: token de captura para ESTE item (o navegador manda junto com a foto). */
export async function abrirCapturaProva(propertyId: string, chave: string): Promise<Res<{ token: string; expiraEm: string }>> {
  const c = await donoDoItem(propertyId, chave);
  if (!c) return { ok: false, erro: "Sem permissão." };
  if (!(await consumirLimite(`prova-captura:${c.uid}`, 200, DIA))) return { ok: false, erro: "Muitas fotos hoje. Tente novamente amanhã." };
  const { token, hash } = novoToken();
  const expiraEm = new Date(Date.now() + TOKEN_CAPTURA_MINUTOS * 60_000).toISOString();
  const { error } = await c.admin.from("prova_capturas").insert({ token_hash: hash, owner_id: c.uid, property_id: propertyId, chave, expira_em: expiraEm });
  if (error) {
    console.error("[abrirCapturaProva]", error.code, error.message);
    return { ok: false, erro: "Não foi possível abrir a câmera agora." };
  }
  return { ok: true, token, expiraEm };
}

/** Endereço desta tela (o laboratório e as prévias apontam para si mesmos; produção, só o domínio da Viva). */
async function origemDaTela(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = (h.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  if (!host || (process.env.VERCEL_ENV === "production" && !DOMINIOS_PROPRIOS.includes(host))) return SITE_URL.replace(/\/$/, "");
  return `${proto}://${host}`;
}

/**
 * No computador: link de uso único para o celular (30 min, ligado ao dono), com o QR para a tela e o mesmo link por
 * e-mail ao dono. O link nunca entra como outra conta (a rota confere).
 */
export async function pedirLinkCelular(propertyId: string, chave: string): Promise<Res<{ url: string; qr: string; expiraEm: string; emailEnviado: boolean }>> {
  const c = await donoDoItem(propertyId, chave);
  if (!c) return { ok: false, erro: "Sem permissão." };
  if (!(await consumirLimite(`prova-link:${c.uid}`, 30, DIA))) return { ok: false, erro: "Muitos links hoje. Tente novamente amanhã." };
  const { token, hash } = novoToken();
  const expiraEm = new Date(Date.now() + LINK_CELULAR_MINUTOS * 60_000).toISOString();
  const { error } = await c.admin.from("prova_links_celular").insert({ token_hash: hash, owner_id: c.uid, property_id: propertyId, chave, expira_em: expiraEm });
  if (error) {
    console.error("[pedirLinkCelular]", error.code, error.message);
    return { ok: false, erro: "Não foi possível gerar o link agora." };
  }
  const caminho = caminhoLinkCelular(token);
  const url = `${await origemDaTela()}${caminho}`;
  const qr = `data:image/svg+xml;utf8,${encodeURIComponent(await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0f1722", light: "#ffffff" } }))}`;
  let emailEnviado = false;
  try {
    const { data: perfil } = await c.admin.from("profiles").select("email, full_name").eq("id", c.uid).maybeSingle();
    const email = (perfil?.email as string | null) ?? c.email;
    if (email) {
      const r = await notify({ event: "nivel_prova_celular", email, name: (perfil?.full_name as string | null) ?? undefined, userId: c.uid, pushUrl: caminho, semPush: true });
      emailEnviado = !!r.email;
    }
  } catch {
    /* o QR e o link na tela bastam */
  }
  return { ok: true, url, qr, expiraEm, emailEnviado };
}

export interface ProvaDoItem {
  origem: OrigemFoto | null;
  capturadaEm: string | null;
  fotoStatus: StatusFoto | null;
}

/** O computador pergunta se a foto da câmera já chegou (QR aberto). */
export async function provaDoItem(propertyId: string, chave: string): Promise<ProvaDoItem | null> {
  const c = await donoDoItem(propertyId, chave);
  if (!c) return null;
  const { data } = await c.admin.from("nivel_itens").select("foto_origem, foto_capturada_em, foto_status").eq("property_id", propertyId).eq("chave", chave).maybeSingle();
  return { origem: (data?.foto_origem as OrigemFoto | null) ?? null, capturadaEm: (data?.foto_capturada_em as string | null) ?? null, fotoStatus: (data?.foto_status as StatusFoto | null) ?? null };
}
