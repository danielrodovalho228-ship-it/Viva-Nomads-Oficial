import { createClient } from "@/lib/supabase/server";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import { COLUNAS_PROVAS, montarDadosProvas, type DadosProvas } from "@/lib/contrato-provas";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dados do pacote de provas (ordem 283d8001). Tudo é lido com a sessão da pessoa, então o RLS decide:
 * quem não é parte do contrato recebe null (a rota responde 404, sem dizer se o contrato existe).
 * A montagem (pagamentos anulados, conferência, situação pelo selo) é a mesma do admin: montarDadosProvas.
 */
export async function carregarProvas(contratoId: string): Promise<DadosProvas | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const visao = await getContratoParaAssinar(contratoId);
  if (!visao) return null;

  const [{ data: contrato }, { data: ass }, { data: pags }, { data: confs }, { data: aditivos }] = await Promise.all([
    supabase.from("contratos").select("created_at").eq("id", contratoId).maybeSingle(),
    supabase.from("contrato_assinaturas").select(COLUNAS_PROVAS.assinaturas).eq("contrato_id", contratoId),
    supabase.from("pagamentos_bloco").select(COLUNAS_PROVAS.pagamentos).eq("contrato_id", contratoId),
    supabase.from("conferencias").select(COLUNAS_PROVAS.conferencias).eq("contrato_id", contratoId),
    supabase.from("contrato_aditivos").select(COLUNAS_PROVAS.aditivos).eq("contrato_id", contratoId),
  ]);
  const ids = (confs ?? []).map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }, { data: laudos }] = ids.length
    ? await Promise.all([
        supabase.from("conferencia_itens").select(COLUNAS_PROVAS.itens).in("conferencia_id", ids),
        supabase.from("conferencia_respostas").select(COLUNAS_PROVAS.respostas).in("conferencia_id", ids),
        supabase.from("conferencia_laudos").select(COLUNAS_PROVAS.laudos).in("conferencia_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return montarDadosProvas({
    contratoId,
    imovel: visao.imovel,
    // Prompt 35B (iii): o selo da fonte única, igual às telas — nunca o status cru do banco.
    situacao: visao.estado.selo,
    registradoEm: String((contrato as { created_at?: string } | null)?.created_at ?? new Date(0).toISOString()),
    resumo: visao.resumo,
    prazoEntradaEm: visao.prazoConferenciaEm,
    prazoSaidaEm: visao.prazoConferenciaSaidaEm,
    assinaturas: ass ?? [],
    pagamentos: pags ?? [],
    conferencias: confs ?? [],
    itens: itens ?? [],
    respostas: respostas ?? [],
    laudos: laudos ?? [],
    aditivos: aditivos ?? [],
  });
}
