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
