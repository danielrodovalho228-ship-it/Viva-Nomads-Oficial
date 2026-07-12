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
 * Geração por IA de título/descrição do anúncio. OFF por padrão até o provedor
 * ser habilitado. Implementação real (não mais mock): rota de servidor
 * `/api/ai/anuncio` chama a API da Anthropic (Claude) — a chave (ANTHROPIC_API_KEY)
 * vive SÓ no servidor, nunca no cliente. Só campos seguros do imóvel vão ao
 * modelo (sem endereço exato/contato/PII), com rate-limit de 10/dia e trilha de
 * auditoria (migration 0045). Coberto na Política de Privacidade (seção 5).
 *
 * Para LIGAR em produção: definir ANTHROPIC_API_KEY (server) e
 * NEXT_PUBLIC_GERACAO_IA="on". A rota exige as DUAS coisas; sem a chave ou a
 * flag, responde 503 sem chamar o provedor.
 */
export const GERACAO_IA_ATIVA = process.env.NEXT_PUBLIC_GERACAO_IA === "on";
