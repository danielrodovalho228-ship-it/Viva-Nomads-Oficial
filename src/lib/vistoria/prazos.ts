/*
  E1118 (ORDEM-DUET-506) — a fonte única dos prazos da avaliação de imóveis, em horas. Módulo folha (não importa
  nada), para a regra, as ações, os e-mails e as telas lerem o MESMO número: texto com o prazo escrito à mão não entra
  (trava: e1118-prazos-sem-literal.test.ts).
  O prazo de reagendar tem a sua própria fonte: REGRAS_AGENDA.antecedenciaReagendarHoras (regras.ts).
*/

/** E682: prazo de resposta do avaliador quando ele não declarou o dele. */
export const PRAZO_RESPOSTA_PADRAO_HORAS = 24;
/** E682: o máximo que o avaliador pode declarar como prazo de resposta. */
export const PRAZO_RESPOSTA_MAX_HORAS = 72;
/** E682 (refino): prazo do DONO para aceitar a proposta do avaliador (decisão do Daniel em 07/11/2026). Passado, a escolha volta ao dono. */
export const PRAZO_DONO_ACEITAR_HORAS = 72;

/**
 * E1156 (ORDENS-DUET 712 e 713): o prazo do LAUDO conta em dias úteis depois da visita. Vale o que o avaliador propôs e
 * o dono aceitou; sem proposta (ou em pedido anterior a esta regra), o padrão — os mesmos 2 dias úteis de antes.
 * E1192: o que é dia útil, e como se soma, está no calendário único (lib/calendario/dias-uteis.ts).
 */
export const PRAZO_LAUDO_PADRAO_DIAS_UTEIS = 2;
/** E1156: o máximo que o avaliador pode propor para o laudo, em dias úteis depois da visita. */
export const PRAZO_LAUDO_MAX_DIAS_UTEIS = 5;

/**
 * E1156: os dias úteis que valem para o laudo de um pedido. Pedido sem prazo proposto usa o padrão; um valor acima do
 * teto nunca vale mais do que o teto (a proposta recusa-o antes de gravar).
 */
export function diasUteisDoLaudo(combinado: number | null | undefined): number {
  if (!Number.isInteger(combinado) || Number(combinado) < 1) return PRAZO_LAUDO_PADRAO_DIAS_UTEIS;
  return Math.min(Number(combinado), PRAZO_LAUDO_MAX_DIAS_UTEIS);
}

/**
 * E1177 (coordenador): em quantos dias úteis a equipe responde ao dono quando a contestação não tem um segundo avaliador
 * na cidade e a equipe assume o pedido.
 */
export const PRAZO_EQUIPE_CONTESTACAO_DIAS_UTEIS = 2;

/** E1156: "1 dia útil" · "3 dias úteis" — a unidade do prazo do laudo, dita do mesmo jeito em todas as telas. */
export const diasUteis = (n: number): string => `${n} ${n === 1 ? "dia útil" : "dias úteis"}`;

/**
 * E1157: o prazo de resposta que vale para um avaliador — o que ele declarou em "Meus termos"; sem declaração (ou com
 * um valor que não é um número de horas), o padrão. A rotina, o relógio do pedido e os textos das telas leem daqui.
 */
export function horasDeResposta(declarado: number | null | undefined): number {
  return Number.isFinite(declarado) && Number(declarado) > 0 ? Number(declarado) : PRAZO_RESPOSTA_PADRAO_HORAS;
}
