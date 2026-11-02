import { createClient } from "@/lib/supabase/server";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import { COLUNAS_PROVAS, montarDadosProvas, type DadosProvas } from "@/lib/contrato-provas";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dados do pacote de provas (ordem 283d8001). Tudo é lido com a sessão da pessoa, então o RLS decide:
 * quem não é parte do contrato recebe null (a rota responde 404, sem dizer se o contrato existe).
 * A montagem (pagamentos anulados, conferência, situação pelo selo) é a mesma do admin: montarDadosProvas.
 */
const MSG_PROVAS_SEM_LEITURA = "Não foi possível ler o contrato para o pacote de provas.";

export async function carregarProvas(contratoId: string): Promise<DadosProvas | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const visao = await getContratoParaAssinar(contratoId);
  if (!visao) return null;

  const [{ data: contrato, error: e1 }, { data: ass, error: e2 }, { data: pags, error: e3 }, { data: confs, error: e4 }, { data: aditivos, error: e5 }] = await Promise.all([
    supabase.from("contratos").select("created_at").eq("id", contratoId).maybeSingle(),
    supabase.from("contrato_assinaturas").select(COLUNAS_PROVAS.assinaturas).eq("contrato_id", contratoId),
    supabase.from("pagamentos_bloco").select(COLUNAS_PROVAS.pagamentos).eq("contrato_id", contratoId),
    supabase.from("conferencias").select(COLUNAS_PROVAS.conferencias).eq("contrato_id", contratoId),
    supabase.from("contrato_aditivos").select(COLUNAS_PROVAS.aditivos).eq("contrato_id", contratoId),
  ]);
  // Achado 77: o pacote de provas é DOCUMENTO registrado (PRV). Leitura que falha não pode virar "sem assinaturas",
  // "sem pagamentos" ou "sem conferência" no PDF: lança, e a rota responde "não foi possível gerar" (nada é registrado).
  if (e1 || e2 || e3 || e4 || e5) throw new Error(MSG_PROVAS_SEM_LEITURA);
  const ids = (confs ?? []).map((c) => c.id as string);
  const [{ data: itens, error: e6 }, { data: respostas, error: e7 }, { data: laudos, error: e8 }] = ids.length
    ? await Promise.all([
        supabase.from("conferencia_itens").select(COLUNAS_PROVAS.itens).in("conferencia_id", ids),
        supabase.from("conferencia_respostas").select(COLUNAS_PROVAS.respostas).in("conferencia_id", ids),
        supabase.from("conferencia_laudos").select(COLUNAS_PROVAS.laudos).in("conferencia_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (e6 || e7 || e8) throw new Error(MSG_PROVAS_SEM_LEITURA);

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
