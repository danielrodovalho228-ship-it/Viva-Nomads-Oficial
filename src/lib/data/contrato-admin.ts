import { createAdminClient } from "@/lib/supabase/admin";
import { getContratoParaEquipe } from "@/lib/data/contrato-assinar-actions";
import { COLUNAS_PROVAS, montarDadosProvas, nomeDoLaudo, totaisPagamentos, type DadosProvas, type PagamentoProva } from "@/lib/contrato-provas";
import { compararHashComResumo, hashResumo } from "@/lib/contrato-assinar";
import { estadoConferencia, estadoConferenciaLista, type EstadoConferencia, type EstadoConferenciaLista, type ParteConferencia, type RespostaConferencia, type TipoConferencia } from "@/lib/conferencia";
import { mesesDoContrato } from "@/lib/admin/indicadores";
import { rotuloBaseTaxa } from "@/lib/taxa-servico-base";
import { assinaturasDoAdmin, type AssinaturaAdmin } from "@/lib/admin/assinaturas-admin";
import { periodoDaEstadia, textoEntrada, textoSaida } from "@/lib/estadia/estadia";

/*
  Admin › contrato, só leitura (Prompt 35B, F5). A checagem de admin (ehAdmin, com AAL2) vem PRIMEIRO, dentro de
  getContratoParaEquipe; só depois o cliente de serviço lê o resto. Fotos e laudos por URL assinada de 10 min.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const BUCKET_CONFERENCIA = "conferencia";
const URL_SEGUNDOS = 600;

export interface ConferenciaAdmin {
  tipo: TipoConferencia;
  estado: EstadoConferencia;
  itens: { id: string; parte: ParteConferencia; comodo: string; descricao: string; fotoUrl: string | null; criadoEm: string }[];
  respostas: { parte: ParteConferencia; decisao: "confirmou" | "contestou"; motivo: string | null; em: string }[];
  laudos: { nome: string; url: string | null; parte: ParteConferencia; em: string }[];
}

export interface ContratoAdminView {
  id: string;
  imovel: string;
  propertyId: string | null;
  selo: string;
  nomes: { proprietario: string | null; inquilino: string | null };
  criadoEm: string;
  resumo: string[];
  hashAtual: string;
  /** E197: registros com hash + as datas do contrato sem registro (hash null). */
  assinaturas: AssinaturaAdmin[];
  pagamentos: PagamentoProva[];
  totais: ReturnType<typeof totaisPagamentos>;
  taxa: string;
  prazoEntradaEm: string | null;
  /** E198: "Entrada: 01/10/2026" e "Saída: 31/10/2026" pelos blocos do contrato (a mesma fonte da página da estadia). */
  periodo: { entrada: string; saida: string };
  conferencias: ConferenciaAdmin[];
  /** A mesma montagem do pacote das partes (#901); a rota do admin acrescenta "Gerado pela equipe…". */
  provas: DadosProvas;
}

export async function carregarContratoAdmin(contratoId: string): Promise<ContratoAdminView | null> {
  const base = await getContratoParaEquipe(contratoId); // ehAdmin no servidor; null para quem não é admin
  if (!base) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const [{ data: extra }, { data: ass }, { data: pags }, { data: confs }, { data: aditivos }] = await Promise.all([
    admin.from("contratos").select("property_id, assinado_proprietario_em, assinado_inquilino_em, aluguel_mensal, prazo_total_dias, comissao_valor, comissao_percent, leads(accepted_at), properties(checkin_after, checkout_before), contrato_blocos(inicio, fim)").eq("id", contratoId).maybeSingle(),
    admin.from("contrato_assinaturas").select(COLUNAS_PROVAS.assinaturas).eq("contrato_id", contratoId),
    admin.from("pagamentos_bloco").select(COLUNAS_PROVAS.pagamentos).eq("contrato_id", contratoId).order("data_pagamento"),
    admin.from("conferencias").select(COLUNAS_PROVAS.conferencias).eq("contrato_id", contratoId),
    admin.from("contrato_aditivos").select(COLUNAS_PROVAS.aditivos).eq("contrato_id", contratoId),
  ]);
  const ids = (confs ?? []).map((c) => c.id as string);
  const [{ data: itens }, { data: respostas }, { data: laudos }] = ids.length
    ? await Promise.all([
        admin.from("conferencia_itens").select(`id, criado_em, ${COLUNAS_PROVAS.itens}`).in("conferencia_id", ids).order("criado_em"),
        admin.from("conferencia_respostas").select(COLUNAS_PROVAS.respostas).in("conferencia_id", ids),
        admin.from("conferencia_laudos").select(COLUNAS_PROVAS.laudos).in("conferencia_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const v = base.visao;
  const provas = montarDadosProvas({
    contratoId,
    imovel: v.imovel,
    situacao: base.selo,
    registradoEm: base.criadoEm,
    resumo: v.resumo,
    prazoEntradaEm: v.prazoConferenciaEm,
    prazoSaidaEm: v.prazoConferenciaSaidaEm,
    assinaturas: ass ?? [],
    pagamentos: pags ?? [],
    conferencias: confs ?? [],
    itens: itens ?? [],
    respostas: respostas ?? [],
    laudos: laudos ?? [],
    aditivos: aditivos ?? [],
  });

  const assinar = async (path: unknown) =>
    path ? ((await admin.storage.from(BUCKET_CONFERENCIA).createSignedUrl(String(path), URL_SEGUNDOS)).data?.signedUrl ?? null) : null;

  const conferencias: ConferenciaAdmin[] = await Promise.all(
    [...(confs ?? [])]
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "entrada" ? -1 : 1))
      .map(async (c) => {
        const rs = (respostas ?? []).filter((r) => r.conferencia_id === c.id);
        return {
          tipo: (c.tipo === "saida" ? "saida" : "entrada") as TipoConferencia,
          estado: estadoConferencia(rs as unknown as RespostaConferencia[]),
          itens: await Promise.all(
            (itens ?? [])
              .filter((i) => i.conferencia_id === c.id)
              .map(async (i) => ({
                id: String(i.id),
                parte: (i.parte === "proprietario" ? "proprietario" : "inquilino") as ParteConferencia,
                comodo: String(i.comodo ?? ""),
                descricao: String(i.descricao ?? ""),
                fotoUrl: await assinar(i.foto_path),
                criadoEm: String(i.criado_em),
              })),
          ),
          respostas: rs.map((r) => ({
            parte: (r.parte === "proprietario" ? "proprietario" : "inquilino") as ParteConferencia,
            decisao: (r.decisao === "contestou" ? "contestou" : "confirmou") as "confirmou" | "contestou",
            motivo: (r.motivo as string | null) ?? null,
            em: String(r.decidido_em),
          })),
          laudos: await Promise.all(
            (laudos ?? [])
              .filter((l) => l.conferencia_id === c.id)
              .map(async (l) => ({ nome: nomeDoLaudo(l.path), url: await assinar(l.path), parte: (l.parte === "proprietario" ? "proprietario" : "inquilino") as ParteConferencia, em: String(l.criado_em) })),
          ),
        };
      }),
  );

  const x = (extra ?? {}) as { property_id?: string; assinado_proprietario_em?: string | null; assinado_inquilino_em?: string | null; aluguel_mensal?: number | string | null; prazo_total_dias?: number | null; comissao_valor?: number | null; comissao_percent?: number | null; leads?: { accepted_at?: string | null } | null; properties?: { checkin_after?: string | null; checkout_before?: string | null } | null; contrato_blocos?: { inicio?: string | null; fim?: string | null }[] | null };
  const periodo = periodoDaEstadia(x.contrato_blocos ?? [], x.properties ?? null);
  const aluguelMensal = Number(x.aluguel_mensal ?? 0);
  const hashAtual = hashResumo(v.resumo);
  return {
    id: contratoId,
    imovel: v.imovel,
    propertyId: x.property_id ?? null,
    selo: base.selo,
    nomes: base.nomes,
    criadoEm: base.criadoEm,
    resumo: v.resumo,
    hashAtual,
    // E197: a lista lê as datas do contrato; o detalhe junta essas datas aos registros com hash.
    assinaturas: assinaturasDoAdmin(
      provas.assinaturas.map((a) => ({ ...a, comparacao: compararHashComResumo(v.resumo, a.hash, base.criadoEm) })),
      { proprietario: x.assinado_proprietario_em ?? null, inquilino: x.assinado_inquilino_em ?? null },
    ),
    pagamentos: provas.pagamentos,
    totais: totaisPagamentos(provas.pagamentos),
    taxa: rotuloBaseTaxa({
      valor: Number(x.comissao_valor ?? 0),
      percent: Number(x.comissao_percent ?? 0),
      aluguelMensal,
      meses: mesesDoContrato(x.prazo_total_dias ?? null),
      aceiteEm: x.leads?.accepted_at ?? null,
    }),
    prazoEntradaEm: v.prazoConferenciaEm,
    periodo: { entrada: textoEntrada(periodo), saida: textoSaida(periodo) },
    conferencias,
    provas,
  };
}

/**
 * Coluna "Conferência de entrada" da lista do admin: o estado de cada contrato (sem conferência = "Não aberta").
 * Lê em lotes de 200 ids (a URL do PostgREST tem limite). Só com o cliente de serviço já liberado por adminDaPagina.
 */
export async function estadosConferenciaEntrada(admin: Admin, contratoIds: string[]): Promise<Map<string, EstadoConferenciaLista>> {
  const out = new Map<string, EstadoConferenciaLista>(contratoIds.map((id) => [id, "nao_aberta"]));
  for (let i = 0; i < contratoIds.length; i += 200) {
    const lote = contratoIds.slice(i, i + 200);
    const { data } = await admin.from("conferencias").select("contrato_id, conferencia_respostas(parte, decisao, motivo)").eq("tipo", "entrada").in("contrato_id", lote);
    for (const c of (data ?? []) as unknown as { contrato_id: string; conferencia_respostas: RespostaConferencia[] | null }[]) {
      out.set(c.contrato_id, estadoConferenciaLista(true, c.conferencia_respostas ?? []));
    }
  }
  return out;
}
