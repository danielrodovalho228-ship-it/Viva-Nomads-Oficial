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

/**
 * Portão do KYC no Fechamento. OFF por padrão = portão SUAVE (reteste QA item 2):
 * enquanto a verificação (CAF) não está integrada, a conta real avança o
 * fechamento com status "Verificação pendente" (registrado e visível ao
 * proprietário no resumo), em vez de travar. Ligue com
 * NEXT_PUBLIC_KYC_PORTAO_RIGIDO="on" quando a CAF integrar — aí a conta real só
 * avança com verificação concluída (o modo demonstração sempre avança, com selo
 * de exemplo).
 */
export const KYC_PORTAO_RIGIDO = process.env.NEXT_PUBLIC_KYC_PORTAO_RIGIDO === "on";

/**
 * Geração por IA de título/descrição do anúncio. OFF por padrão (item 7 do QA do
 * editor). Hoje o botão é um MOCK — não envia foto nem texto a nenhum provedor
 * externo (título/descrição são canned, gerados no navegador). Enquanto:
 *   • não houver um provedor real definido, E
 *   • o envio das fotos não estiver descrito na Política de Privacidade,
 * a funcionalidade fica desligada por esta flag. TODO(juridico — Beatriz):
 * antes de ligar (NEXT_PUBLIC_GERACAO_IA="on"), documentar qual provedor recebe
 * as fotos e cobrir o tratamento na Política de Privacidade.
 */
export const GERACAO_IA_ATIVA = process.env.NEXT_PUBLIC_GERACAO_IA === "on";
