/**
 * Feature flags de UI (mesmo padrão de CAUCAO_PARCELADA_UI em faixas.ts).
 * Todas OFF por padrão — ligam com NEXT_PUBLIC_<FLAG>="on" na Vercel.
 */

/** Programa de indicação: item de menu só aparece quando o programa existir. */
export const PROGRAMA_INDICACAO = process.env.NEXT_PUBLIC_PROGRAMA_INDICACAO === "on";

/**
 * Selo "Emite Nota Fiscal" na UI pública. OFF por padrão: proprietário PF emite
 * recibo, não NF — o selo como está promete errado. O dado continua no banco; a
 * definição correta (recibo / NF só para PJ) sai depois com o jurídico.
 */
export const SELO_NF_UI = process.env.NEXT_PUBLIC_SELO_NF_UI === "on";
