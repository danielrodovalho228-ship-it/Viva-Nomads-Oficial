/*
  E1103 (ORDEM-DUET-467) — a visita CONFIRMADA de uma avaliação, numa regra só. A visita de hoje aparecia na tela do
  pedido dos dois lados, mas a Agenda geral do parceiro não a listava: a Agenda só lia os pedidos de serviço.
  Regra PURA (testada em e1103-visita-na-agenda.test.ts). Leem daqui: a Agenda do painel do parceiro e o resumo do painel
  do avaliador ("visitas de hoje").

  Confirmada = o pedido está "agendado" e tem data. O imóvel ocupado só chega a "agendado" quando o morador concorda;
  antes disso a data é só uma proposta e não entra na Agenda.
*/
import { dataHoraBRT, diaBRT } from "../datas-brasilia.ts";
import type { ItemAgendaParceiro } from "../parceiros/agenda-parceiro.ts";
import type { ItemAgenda } from "../agenda.ts";

export interface VisitaDoAvaliador {
  id: string;
  status: string;
  agendado_para: string | null;
  cidade?: string | null;
}

export function visitaConfirmada(p: { status: string; agendado_para: string | null }): boolean {
  return p.status === "agendado" && Boolean(p.agendado_para);
}

/** O que a linha da Agenda diz ao lado da data e da hora. */
export const ROTULO_VISITA_NA_AGENDA = "Visita de avaliação";

/** A linha leva à tela da visita daquele pedido. */
export const hrefDaVisita = (pedidoId: string): string => `/dashboard/parceiro/avaliacao/${pedidoId}`;

/** As visitas confirmadas como itens da Agenda do parceiro (as demais ficam de fora). */
export function visitasNaAgenda(pedidos: readonly VisitaDoAvaliador[]): ItemAgendaParceiro[] {
  return pedidos.filter(visitaConfirmada).map((p) => ({
    id: p.id,
    dia: diaBRT(p.agendado_para) ?? "",
    quando: dataHoraBRT(p.agendado_para),
    categoria: p.cidade ? `${ROTULO_VISITA_NA_AGENDA} · ${p.cidade}` : ROTULO_VISITA_NA_AGENDA,
    href: hrefDaVisita(p.id),
    em: p.agendado_para as string,
  }));
}

/** E1174: do lado do dono, a visita leva ao bloco da avaliação daquele imóvel (onde ele vê o pedido e pode reagendar). */
export const hrefDaAvaliacaoDoImovel = (propertyId: string): string => `/dashboard/imoveis/${propertyId}/nivel#avaliacao`;

/**
 * E1174 (ORDENS-DUET 752 e 788): as visitas de avaliação CONFIRMADAS como itens da Agenda do dono — a mesma regra do
 * avaliador (visitaConfirmada). O imóvel ocupado só chega a "agendado" quando o morador concorda; antes disso a data é
 * uma proposta e fica de fora. Só entram os imóveis do dono (`titulos`: id → título).
 * Na Agenda é uma visita presencial como as outras (mesmo tipo, mesma cor, mesmo ícone); a marca `avaliacao` troca o
 * rótulo e tira o "Interessado(a)".
 */
export function visitasNaAgendaDoDono(pedidos: readonly { id: string; property_id: string; status: string; agendado_para: string | null }[], titulos: ReadonlyMap<string, string>): ItemAgenda[] {
  return pedidos
    .filter((p) => visitaConfirmada(p) && titulos.has(p.property_id))
    .map((p) => ({
      id: `avaliacao-${p.id}`,
      tipo: "visita" as const,
      avaliacao: true,
      modalidade: "presencial" as const,
      propertyId: p.property_id,
      imovel: titulos.get(p.property_id) as string,
      quando: p.agendado_para as string,
      pessoa: null,
      href: hrefDaAvaliacaoDoImovel(p.property_id),
    }));
}
