/*
  E399-C, pacote 2 — a comparação no servidor (sem "use server": recebe o cliente de serviço).
   - compararAnuncio: confere de novo cidade e quartos, consulta o calendário pela fonte em uso (hoje a SIMULADA, sem
     rede), grava o total de 30 noites e a hora, e, se a Viva ficou igual ou acima, avisa SÓ o dono (e-mail
     preco_justo_acima; uma vez por valor).
   - rotinaPrecoJusto: a reconsulta semanal (7 dias), chamada pelo cron do calendário. Com a chave desligada, não faz nada.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRECO_JUSTO_COMPARADOR } from "@/lib/flags";
import { calcularTudoIncluido } from "@/lib/precos";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { notify } from "@/lib/notifications";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { formatBRL } from "@/lib/utils";
import { escaparHtml } from "@/lib/escapar-html";
import { conferirAnuncio, type Conferencia } from "@/lib/comparador-airbnb/antifraude";
import { decidirSelo, precisaReconsultar, total30Noites, type DecisaoSelo } from "@/lib/comparador-airbnb/comparacao";
import { fonteAtual } from "@/lib/comparador-airbnb/fonte";

export const COLUNAS_IMOVEL_PRECO = "id, title, owner_id, city, bedrooms, monthly_price, condo_fee, utilities_mode, utilities_estimate, limpeza_estadia";

export interface ImovelParaPreco {
  id: string;
  title: string | null;
  owner_id: string;
  city: string | null;
  bedrooms: number | null;
  monthly_price: number | null;
  condo_fee: number | null;
  utilities_mode: string | null;
  utilities_estimate: number | null;
  limpeza_estadia: unknown;
}

export interface LinhaPrecoJusto {
  property_id: string;
  airbnb_id: string;
  conferencia: Conferencia;
  consultado_em: string | null;
  total_30_noites: number | null;
  aviso_valor: number | null;
}

/** O Total por mês da Viva (com contas): a mesma conta do cartão e da busca. */
export function totalVivaDoImovel(p: ImovelParaPreco): number {
  return calcularTudoIncluido({
    monthlyPrice: Number(p.monthly_price) || 0,
    condoFee: Number(p.condo_fee) || 0,
    utilitiesMode: p.utilities_mode === "fixed" ? "fixed" : "real",
    utilitiesEstimate: Number(p.utilities_estimate) || 0,
    limpezaEstadia: normalizarLimpezaEstadia(p.limpeza_estadia) ?? undefined,
  }).total;
}

export async function compararAnuncio(admin: SupabaseClient, linha: LinhaPrecoJusto, imovel: ImovelParaPreco, agora: Date): Promise<DecisaoSelo> {
  const fonte = fonteAtual();
  const referencia = { cidade: imovel.city, quartos: imovel.bedrooms };
  const conf = conferirAnuncio(referencia, await fonte.detalhesDoAnuncio(linha.airbnb_id, referencia));
  const conferencia: Conferencia = conf.confere ? "confere" : "diverge";
  const t = conf.confere ? total30Noites(await fonte.calendario(linha.airbnb_id, agora)) : null;
  const quando = agora.toISOString();
  const { error } = await admin
    .from("preco_justo_airbnb")
    .update({ conferencia, divergencias: conf.divergencias, conferido_em: quando, total_30_noites: t?.total ?? null, consultado_em: quando, fonte: fonte.nome, atualizado_em: quando })
    .eq("property_id", linha.property_id);
  if (error) throw new Error("Não foi possível gravar a comparação do Preço justo.");
  const decisao = decidirSelo({ totalViva: totalVivaDoImovel(imovel), total30: t?.total ?? null, consultadoEm: quando, conferencia }, agora);
  if (decisao.avisoDono && Number(linha.aviso_valor) !== decisao.avisoDono.valorAirbnb) {
    await avisarDono(admin, imovel, totalVivaDoImovel(imovel), decisao.avisoDono);
    await admin.from("preco_justo_airbnb").update({ aviso_enviado_em: quando, aviso_valor: decisao.avisoDono.valorAirbnb }).eq("property_id", linha.property_id);
  }
  return decisao;
}

async function avisarDono(admin: SupabaseClient, imovel: ImovelParaPreco, totalViva: number, aviso: { valorAirbnb: number; ate: number }) {
  const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", imovel.owner_id).maybeSingle();
  const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
  const linhas = [
    { rotulo: "Imóvel", valor: imovel.title ?? "Seu anúncio" },
    { rotulo: "Total por mês na Viva", valor: formatBRL(totalViva) },
    { rotulo: "30 noites no Airbnb", valor: formatBRL(aviso.valorAirbnb) },
    { rotulo: "Para ganhar o selo", valor: `total por mês até ${formatBRL(aviso.ate)}` },
  ];
  await notify({
    event: "preco_justo_acima",
    email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
    name: d?.full_name ?? undefined,
    userId: imovel.owner_id,
    pushUrl: `/dashboard/imoveis/${imovel.id}/editar`,
    detailsHtml: blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))),
    detailsText: linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n"),
  }).catch(() => {});
}

/** Reconsulta semanal (chamada pelo cron do calendário). Com a chave desligada, não faz nada. */
export async function rotinaPrecoJusto(admin: SupabaseClient, agora: Date): Promise<{ precoJusto: { consultados: number; falhas: number } | "desligado" }> {
  if (!PRECO_JUSTO_COMPARADOR) return { precoJusto: "desligado" };
  const { data, error } = await admin
    .from("preco_justo_airbnb")
    .select(`property_id, airbnb_id, conferencia, consultado_em, total_30_noites, aviso_valor, properties!inner(${COLUNAS_IMOVEL_PRECO})`)
    .order("consultado_em", { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) throw new Error("Não foi possível ler os links do Preço justo.");
  let consultados = 0;
  let falhas = 0;
  for (const l of (data ?? []) as unknown as (LinhaPrecoJusto & { properties: ImovelParaPreco })[]) {
    if (!precisaReconsultar(l.consultado_em, agora)) continue;
    try {
      await compararAnuncio(admin, l, l.properties, agora);
      consultados++;
    } catch {
      falhas++;
    }
  }
  return { precoJusto: { consultados, falhas } };
}

/** Pacote 4: os anúncios (entre `ids`) com o selo pelo motor — a mesma regra do cartão, da ficha e do ranking. */
export async function selosDoMotor(admin: SupabaseClient, ids: string[], agora: Date): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const { data, error } = await admin
    .from("preco_justo_airbnb")
    .select(`property_id, conferencia, total_30_noites, consultado_em, properties!inner(${COLUNAS_IMOVEL_PRECO})`)
    .in("property_id", ids);
  if (error) throw new Error("Não foi possível ler os selos do Preço justo.");
  for (const r of (data ?? []) as unknown as { property_id: string; conferencia: Conferencia; total_30_noites: number | null; consultado_em: string | null; properties: ImovelParaPreco }[]) {
    const total30 = r.total_30_noites == null ? null : Number(r.total_30_noites);
    if (decidirSelo({ totalViva: totalVivaDoImovel(r.properties), total30, consultadoEm: r.consultado_em, conferencia: r.conferencia }, agora).selo) out.add(r.property_id);
  }
  return out;
}

/** Pacote 5: o aviso do dono ("sem selo: no Airbnb R$ X; até R$ Y") para a lista de anúncios dele. Nunca público. */
export async function avisosDoMotor(admin: SupabaseClient, ids: string[], agora: Date): Promise<Map<string, { valorAirbnb: number; ate: number }>> {
  const out = new Map<string, { valorAirbnb: number; ate: number }>();
  if (!ids.length) return out;
  const { data, error } = await admin
    .from("preco_justo_airbnb")
    .select(`property_id, conferencia, total_30_noites, consultado_em, properties!inner(${COLUNAS_IMOVEL_PRECO})`)
    .in("property_id", ids);
  if (error) throw new Error("Não foi possível ler o Preço justo dos anúncios.");
  for (const r of (data ?? []) as unknown as { property_id: string; conferencia: Conferencia; total_30_noites: number | null; consultado_em: string | null; properties: ImovelParaPreco }[]) {
    const total30 = r.total_30_noites == null ? null : Number(r.total_30_noites);
    const d = decidirSelo({ totalViva: totalVivaDoImovel(r.properties), total30, consultadoEm: r.consultado_em, conferencia: r.conferencia }, agora);
    if (d.avisoDono) out.set(r.property_id, d.avisoDono);
  }
  return out;
}

