"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_FOTOS_PET, caminhoFotoPetValido } from "@/lib/anuncio/ficha-pet-fotos";
import { normalizarRegrasPets, ROTULO_ESPECIE, type EspeciePet, type PortePet } from "@/lib/anuncio/pets-regras";
import {
  conferenciaPetComRegras,
  conferenciaQuantidade,
  donoVeFichaPet,
  PORTE_CURTO,
  PRAZO_LINK_FICHA_PET_S,
  resumoPetsCandidatura,
} from "@/lib/anuncio/ficha-pet-dono";

/*
  Ficha do pet para o DONO, só no contexto da candidatura (complemento do #876). O RLS de pets_inquilino e as
  políticas do bucket pets-fotos continuam só da própria pessoa: o dono chega à ficha APENAS por estas funções,
  que conferem que ele é o dono daquela candidatura e que ela está viva (pendente, aceita ou com contrato em
  andamento). As fotos e a carteira saem como links assinados de 10 minutos. Nunca contato do inquilino.
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FichaPetDono {
  nome: string;
  especie: string;
  porte: string;
  raca: string;
  observacoes: string;
  fotos: string[];
  carteira: string | null;
  conferencia: { ok: boolean; texto: string };
}

export interface FichaPetsCandidatura {
  pets: FichaPetDono[];
  /** "Fora das regras: o anúncio aceita até 1 animal" quando há mais pets do que o anúncio aceita. */
  quantidade: string | null;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type LinhaPet = { nome: string; especie: EspeciePet; porte: PortePet; raca: string | null; observacoes: string | null; fotos: string[] | null; carteira_vacina: string | null };
interface Candidatura {
  id: string;
  tenantId: string;
  propertyId: string;
}

/** A candidatura do usuário logado (como DONO) que ainda dá acesso à ficha; senão null. */
async function candidaturaDoDono(alvo: { leadId: string } | { propertyId: string; tenantId: string }): Promise<{ admin: Admin; lead: Candidatura } | null> {
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return null;
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user) return null;
  let q = admin.from("leads").select("id, owner_id, tenant_id, property_id, status").eq("owner_id", user.id);
  if ("leadId" in alvo) {
    if (!UUID_RE.test(String(alvo.leadId))) return null;
    q = q.eq("id", alvo.leadId);
  } else {
    if (!UUID_RE.test(String(alvo.propertyId)) || !UUID_RE.test(String(alvo.tenantId))) return null;
    q = q.eq("property_id", alvo.propertyId).eq("tenant_id", alvo.tenantId);
  }
  const { data: leads } = await q.order("created_at", { ascending: false }).limit(1);
  const l = ((leads ?? []) as { id: string; owner_id: string; tenant_id: string; property_id: string; status: string }[])[0];
  if (!l || l.owner_id !== user.id) return null;
  const { data: cs } = await admin
    .from("contratos")
    .select("status")
    .eq("property_id", l.property_id)
    .eq("tenant_id", l.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1);
  const contratoStatus = ((cs ?? []) as { status: string }[])[0]?.status ?? null;
  if (!donoVeFichaPet({ leadStatus: l.status, contratoStatus })) return null;
  return { admin, lead: { id: l.id, tenantId: l.tenant_id, propertyId: l.property_id } };
}

async function petsDoInquilino(admin: Admin, tenantId: string): Promise<LinhaPet[]> {
  const { data } = await admin
    .from("pets_inquilino")
    .select("nome, especie, porte, raca, observacoes, fotos, carteira_vacina")
    .eq("user_id", tenantId)
    .order("criado_em");
  return (data ?? []) as LinhaPet[];
}

/** Resumo do cartão ("Com 1 pet · Totó (cão, porte médio)") e o id da candidatura, sem links. Sem acesso: null. */
export async function resumoFichaPets(alvo: { leadId: string } | { propertyId: string; tenantId: string }): Promise<{ leadId: string; resumo: string } | null> {
  const c = await candidaturaDoDono(alvo);
  if (!c) return null;
  const resumo = resumoPetsCandidatura(await petsDoInquilino(c.admin, c.lead.tenantId));
  return resumo ? { leadId: c.lead.id, resumo } : null;
}

/**
 * A ficha completa para o dono da candidatura: nome, espécie, porte, raça, observações, as fotos e a carteira de
 * vacina em links assinados de 10 minutos, e a conferência com as regras do anúncio. Outro dono, outra pessoa,
 * candidatura recusada ou contrato encerrado: vazio.
 */
export async function fichaPetsDaCandidatura(leadId: string): Promise<FichaPetsCandidatura> {
  const vazio: FichaPetsCandidatura = { pets: [], quantidade: null };
  const c = await candidaturaDoDono({ leadId });
  if (!c) return vazio;
  const { admin, lead } = c;
  const [linhas, { data: imovel }] = await Promise.all([
    petsDoInquilino(admin, lead.tenantId),
    admin.from("properties").select("pets_allowed, pets_regras").eq("id", lead.propertyId).maybeSingle(),
  ]);
  if (linhas.length === 0) return vazio;
  const petsAllowed = (imovel as { pets_allowed?: boolean | null } | null)?.pets_allowed ?? null;
  const regras = normalizarRegrasPets((imovel as { pets_regras?: unknown } | null)?.pets_regras);

  // Só caminhos da pasta do PRÓPRIO inquilino desta candidatura (nada de caminho de outra conta).
  const caminhos = linhas.flatMap((l) => [...(l.fotos ?? []), ...(l.carteira_vacina ? [l.carteira_vacina] : [])]).filter((p) => caminhoFotoPetValido(p, lead.tenantId));
  const urls = new Map<string, string>();
  if (caminhos.length) {
    const { data: assinadas } = await admin.storage.from(BUCKET_FOTOS_PET).createSignedUrls(caminhos, PRAZO_LINK_FICHA_PET_S);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  }
  return {
    pets: linhas.map((l) => ({
      nome: l.nome,
      especie: ROTULO_ESPECIE[l.especie],
      porte: PORTE_CURTO[l.porte],
      raca: (l.raca ?? "").trim(),
      observacoes: (l.observacoes ?? "").trim(),
      fotos: (l.fotos ?? []).map((p) => urls.get(p)).filter((u): u is string => !!u),
      carteira: l.carteira_vacina ? (urls.get(l.carteira_vacina) ?? null) : null,
      conferencia: conferenciaPetComRegras(petsAllowed, regras, l),
    })),
    quantidade: conferenciaQuantidade(petsAllowed, regras, linhas.length),
  };
}
