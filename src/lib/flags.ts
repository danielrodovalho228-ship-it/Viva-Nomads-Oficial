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

/**
 * Piloto "Fundador": banner em /precos com assinatura gratuita por 12 meses aos
 * 20 primeiros proprietários (recursos do Profissional), comissão de fechamento
 * normal (8%) e 20% de desconto vitalício quando a cobrança começar. Nenhuma
 * cobrança de assinatura é ativada no piloto.
 */
export const PLANO_FUNDADOR = process.env.NEXT_PUBLIC_PLANO_FUNDADOR === "on";
