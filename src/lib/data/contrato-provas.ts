import { createClient } from "@/lib/supabase/server";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import type { DadosProvas } from "@/lib/contrato-provas";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dados do pacote de provas (ordem 283d8001). Tudo é lido com a sessão da pessoa, então o RLS decide:
 * quem não é parte do contrato recebe null (a rota responde 404, sem dizer se o contrato existe).
 */
export async function carregarProvas(contratoId: string): Promise<DadosProvas | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const visao = await getContratoParaAssinar(contratoId);
  if (!visao) return null;

  const [{ data: contrato }, { data: ass }, { data: pags }, { data: confs }] = await Promise.all([
    supabase.from("contratos").select("created_at").eq("id", contratoId).maybeSingle(),
    supabase.from("contrato_assinaturas").select("papel, assinado_em, hash_documento").eq("contrato_id", contratoId),
    supabase.from("pagamentos_bloco").select("tipo, valor, forma, data_pagamento, confirmado_pelo_inquilino, confirmado_em").eq("contrato_id", contratoId),
    supabase.from("conferencias").select("id, tipo, criada_em").eq("contrato_id", contratoId),
  ]);
  const ids = (confs ?? []).map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }] = ids.length
    ? await Promise.all([
        supabase.from("conferencia_itens").select("conferencia_id, parte").in("conferencia_id", ids),
        supabase.from("conferencia_respostas").select("conferencia_id, parte, decisao, decidido_em").in("conferencia_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    contratoId,
    imovel: visao.imovel,
    status: visao.status,
    registradoEm: String((contrato as { created_at?: string } | null)?.created_at ?? new Date(0).toISOString()),
    resumo: visao.resumo,
    assinaturas: (ass ?? []).map((a) => ({ papel: a.papel as "proprietario" | "inquilino", em: String(a.assinado_em), hash: String(a.hash_documento) })),
    pagamentos: (pags ?? []).map((p) => ({
      tipo: p.tipo === "caucao" ? "caucao" : "aluguel",
      valor: Number(p.valor),
      forma: String(p.forma),
      dia: String(p.data_pagamento).slice(0, 10),
      confirmadoEm: p.confirmado_pelo_inquilino ? String(p.confirmado_em ?? p.data_pagamento) : null,
    })),
    conferencias: (confs ?? []).map((c) => {
      const daConf = (itens ?? []).filter((i) => i.conferencia_id === c.id);
      return {
        tipo: c.tipo === "saida" ? "saida" : "entrada",
        abertaEm: String(c.criada_em),
        itensPorParte: {
          proprietario: daConf.filter((i) => i.parte === "proprietario").length,
          inquilino: daConf.filter((i) => i.parte === "inquilino").length,
        },
        respostas: (respostas ?? [])
          .filter((r) => r.conferencia_id === c.id)
          .map((r) => ({ parte: r.parte as "proprietario" | "inquilino", decisao: r.decisao as "confirmou" | "contestou", em: String(r.decidido_em) })),
      };
    }),
  };
}
