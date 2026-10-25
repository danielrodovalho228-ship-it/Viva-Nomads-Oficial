"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite } from "@/lib/limites";
import { revalidarAnuncio } from "@/lib/anuncio/revalidar";
import { LIMITE_LINKS_POR_IMOVEL, dominioDoLink, origemDoLink, urlIcalPermitida, type OrigemLink } from "@/lib/calendario/importar";
import { importacaoPorId, lerLink, sincronizarImportacao } from "@/lib/calendario/importar-servidor";

/*
  Prompt 53 — "Importar datas de outro site" no calendário do imóvel. Só o dono do imóvel; grava pelo servidor (a tabela
  é restrita) depois de conferir o dono. A tela recebe só domínio, origem, última leitura e erro — nunca o link.
*/

export interface ImportacaoNaTela {
  id: string;
  dominio: string;
  origem: OrigemLink;
  ultimaLeitura: string | null;
  erro: string | null;
}

type Res = { ok: boolean; erro?: string; mensagem?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function donoDoImovel(propertyId: string) {
  if (!UUID.test(propertyId)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await admin.from("properties").select("id").eq("id", propertyId).eq("owner_id", user.id).maybeSingle();
  return data ? { admin, userId: user.id } : null;
}

async function donoDaImportacao(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const imp = await importacaoPorId(admin, id);
  return imp && imp.owner_id === user.id ? { admin, imp } : null;
}

const depois = (propertyId: string) => {
  revalidatePath(`/dashboard/imoveis/${propertyId}/editar`);
  revalidarAnuncio(propertyId, revalidatePath);
};

export async function listarImportacoes(propertyId: string): Promise<ImportacaoNaTela[]> {
  const d = await donoDoImovel(propertyId);
  if (!d) return [];
  const { data } = await d.admin
    .from("calendario_importacoes")
    .select("id, dominio, origem, ultima_leitura, ultimo_erro")
    .eq("property_id", propertyId)
    .order("criado_em");
  return ((data ?? []) as { id: string; dominio: string; origem: OrigemLink; ultima_leitura: string | null; ultimo_erro: string | null }[]).map((r) => ({
    id: r.id,
    dominio: r.dominio,
    origem: r.origem,
    ultimaLeitura: r.ultima_leitura,
    erro: r.ultimo_erro,
  }));
}

/** Cola o link: confere (https, calendário, até 1 MB), grava e já importa as datas. Até 3 por imóvel. */
export async function adicionarImportacao(propertyId: string, link: string): Promise<Res> {
  const d = await donoDoImovel(propertyId);
  if (!d) return { ok: false, erro: "Anúncio não encontrado." };
  const v = urlIcalPermitida(link);
  if (!v.ok) return { ok: false, erro: v.erro };
  const { count } = await d.admin.from("calendario_importacoes").select("id", { count: "exact", head: true }).eq("property_id", propertyId);
  if ((count ?? 0) >= LIMITE_LINKS_POR_IMOVEL) return { ok: false, erro: `Até ${LIMITE_LINKS_POR_IMOVEL} calendários por imóvel. Remova um para colar outro.` };
  if (!(await consumirLimite(`calendario:add:${d.userId}`, 20, 3600))) return { ok: false, erro: "Muitas tentativas. Tente de novo em alguns minutos." };
  const teste = await lerLink(v.url);
  if (!teste.ok) return { ok: false, erro: `Não conseguimos ler esse link: ${teste.erro}. Confira se é o link de exportação (.ics).` };
  const { data, error } = await d.admin
    .from("calendario_importacoes")
    .insert({ property_id: propertyId, owner_id: d.userId, url: v.url, dominio: dominioDoLink(v.url), origem: origemDoLink(v.url) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, erro: error?.code === "23505" ? "Esse link já está importado." : "Não foi possível salvar agora. Tente de novo." };
  const imp = await importacaoPorId(d.admin, data.id as string);
  const r = imp ? await sincronizarImportacao(d.admin, imp) : null;
  depois(propertyId);
  return { ok: true, mensagem: r?.ok ? `Calendário importado: ${r.inseridos} ${r.inseridos === 1 ? "período ocupado" : "períodos ocupados"}.` : "Link salvo. A primeira leitura falhou; tentamos de novo em 3 horas." };
}

/** "Atualizar agora" (no máximo 6 por hora por importação). */
export async function atualizarImportacao(id: string): Promise<Res> {
  const d = await donoDaImportacao(id);
  if (!d) return { ok: false, erro: "Calendário não encontrado." };
  if (!(await consumirLimite(`calendario:atualizar:${id}`, 6, 3600))) return { ok: false, erro: "Já atualizado há pouco. Tente de novo em alguns minutos." };
  const r = await sincronizarImportacao(d.admin, d.imp);
  depois(d.imp.property_id);
  return r.ok
    ? { ok: true, mensagem: `Atualizado: ${r.inseridos} ${r.inseridos === 1 ? "novo" : "novos"}, ${r.removidos} ${r.removidos === 1 ? "liberado" : "liberados"}.` }
    : { ok: false, erro: r.erro };
}

/** Remove o link e as datas que vieram dele (os bloqueios manuais ficam). */
export async function removerImportacao(id: string): Promise<Res> {
  const d = await donoDaImportacao(id);
  if (!d) return { ok: false, erro: "Calendário não encontrado." };
  const { error } = await d.admin.from("calendario_importacoes").delete().eq("id", id).eq("owner_id", d.imp.owner_id);
  if (error) return { ok: false, erro: "Não foi possível remover agora." };
  depois(d.imp.property_id);
  return { ok: true, mensagem: "Calendário removido; as datas que vieram dele foram liberadas." };
}
