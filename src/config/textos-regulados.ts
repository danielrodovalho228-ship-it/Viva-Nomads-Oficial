/**
 * E776 — TEXTOS-FONTE ÚNICOS das frases reguladas por regra aprovada. Cada frase mora AQUI (ou numa fonte já existente,
 * reexportada daqui) e as telas só a importam. O CI barra as formulações proibidas em qualquer superfície
 * (`src/lib/frases-proibidas.test.ts`, regras em `src/lib/frases-proibidas.ts`).
 *
 *  • Contato (E445): telefone, e-mail e redes sociais NUNCA são trocados entre as partes; a conversa fica no chat da Viva.
 *    (O fluxo de PARCEIROS tem regra própria já implementada — `src/lib/parceiros/` — e fica fora do gate, de forma explícita.)
 *  • Caução (desenho aprovado): paga direto ao proprietário, a Viva não recebe nem segura o dinheiro (`CAUCAO_FRASE`).
 *  • Taxas: uma regra única de cobrança (`TEXTO_REGRA_UNICA`).
 */
export { CAUCAO_FRASE } from "../lib/faixas.ts";
export { TEXTO_REGRA_UNICA } from "../lib/cobranca/regra.ts";

/** Fragmento único sobre contato: entra em toda frase que fala de telefone, e-mail ou redes. */
export const CONTATO_NUNCA_TROCADO = "telefone, e-mail e redes sociais nunca são trocados";

/** Frase única sobre com quem o morador conversa (a mesma da home, do como funciona e do anúncio). */
export const FRASE_CONVERSA_CHAT = `Converse com o proprietário pelo chat da Viva; ${CONTATO_NUNCA_TROCADO}.`;
export const PASSO_CONVERSE_TEXTO = `Tire dúvidas pelo chat da Viva e agende a visita pela plataforma; ${CONTATO_NUNCA_TROCADO}.`;
export const DIFERENCIAL_CHAT = "Chat da Viva com o morador, sem troca de contato direto";
/** E785: selo curto da faixa de confiança (no lugar de "contato protegido até o aceite", que sugeria troca depois do aceite). */
export const SELO_SEM_TROCA_DE_CONTATO = "Sem troca de contato direto";
/** E785: a frase da negociação na plataforma. */
export const FRASE_NEGOCIACAO_NA_PLATAFORMA = `Negociação na plataforma, pelo chat da Viva; ${CONTATO_NUNCA_TROCADO}.`;

/** Linha curta para os estados vazios do centro de mensagens. */
export const NOTA_CONTATO_MENSAGENS = "telefone e e-mail nunca são trocados: tudo fica no chat da Viva.";
/** Visitas: o nome completo aparece depois do aceite; o contato nunca é trocado. */
export const NOTA_VISITA_DONO = "O nome completo do interessado aparece depois do aceite; telefone e e-mail nunca são trocados.";
