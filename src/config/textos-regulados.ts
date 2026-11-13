/**
 * E776 — TEXTOS-FONTE ÚNICOS das frases reguladas por regra aprovada. Cada frase mora AQUI (ou numa fonte já existente,
 * reexportada daqui) e as telas só a importam. O CI barra as formulações proibidas em qualquer superfície
 * (`src/lib/frases-proibidas.test.ts`, regras em `src/lib/frases-proibidas.ts`).
 *
 *  • Contato (E445): telefone, e-mail e redes sociais NUNCA são trocados entre as partes; a conversa fica no chat da Viva.
 *    (O fluxo de PARCEIROS tem regra própria já implementada — `src/lib/parceiros/` — e fica fora do gate, de forma explícita.)
 *  • Caução (desenho aprovado): paga direto ao proprietário, a Viva não recebe nem segura o dinheiro (`CAUCAO_FRASE`).
 *  • Taxas: uma regra única de cobrança (`TEXTO_REGRA_UNICA`); a escada completa das faixas + o Plano Gestor (E805,
 *    `FRASE_ESCADA_TAXAS`). A cobrança na renovação NÃO entra nas páginas públicas enquanto aguarda o parecer jurídico.
 */
import { escadaTaxasTexto } from "../lib/cobranca/regra.ts";
import { GESTOR_TEXTO } from "./planos.ts";
export { CAUCAO_FRASE } from "../lib/faixas.ts";
export { TEXTO_REGRA_UNICA } from "../lib/cobranca/regra.ts";

/**
 * E805 — a escada inteira da taxa de serviço, igual em /para-proprietarios e /como-funciona (a Ajuda tem a tabela):
 * "Quanto mais imóveis ativos, menor a taxa: 1–2 imóveis: 12% · … · 16–19 imóveis: 6%. Plano Gestor: 4% para …".
 */
export const FRASE_ESCADA_TAXAS = `Quanto mais imóveis ativos, menor a taxa: ${escadaTaxasTexto()}. Plano Gestor: ${GESTOR_TEXTO}.`;

/** Fragmento único sobre contato: entra em toda frase que fala de telefone, e-mail ou redes. */
export const CONTATO_NUNCA_TROCADO = "telefone, e-mail e redes sociais nunca são trocados";

/** Frase única sobre com quem o morador conversa (a mesma da home, do como funciona e do anúncio). */
export const FRASE_CONVERSA_CHAT = `Converse com o proprietário pelo chat da Viva; ${CONTATO_NUNCA_TROCADO}.`;
export const PASSO_CONVERSE_TEXTO = `Tire dúvidas pelo chat da Viva e agende a visita pela plataforma; ${CONTATO_NUNCA_TROCADO}.`;
export const DIFERENCIAL_CHAT = "Chat da Viva com o morador, sem troca de contato direto";
/** E785: selo curto da faixa de confiança (no lugar de "contato protegido até o aceite", que sugeria troca depois do aceite). */
export const SELO_PERFIL_VERIFICADO = "Perfil verificado";
/** E785: a frase da negociação na plataforma. */
export const FRASE_NEGOCIACAO_NA_PLATAFORMA = `Negociação na plataforma, pelo chat da Viva; ${CONTATO_NUNCA_TROCADO}.`;

/** Linha curta para os estados vazios do centro de mensagens. */
export const NOTA_CONTATO_MENSAGENS = "telefone e e-mail nunca são trocados: tudo fica no chat da Viva.";
/** E794 (regra E445): a landing de Parceiros não promete nada revelado depois do aceite; o contato nunca é trocado. */
export const PARCEIROS_HEROI_SUBTITULO =
  "Atenda quem anuncia e quem busca imóveis mobiliados, com conversa só pela plataforma; o seu contato nunca é trocado.";
export const PARCEIROS_NUMERO_CONTATO = { titulo: "Contato só pela plataforma", nota: "o seu contato nunca é trocado" } as const;

/** Visitas: o nome completo aparece depois do aceite; o contato nunca é trocado. */
export const NOTA_VISITA_DONO = "O nome completo do interessado aparece depois do aceite; telefone e e-mail nunca são trocados.";

/**
 * E826 — a promessa geral da estadia com a ressalva honesta: o mínimo varia por anúncio (o ube-003 pede 60 dias). O
 * cartão da busca mostra o mínimo de quem pede mais (cartao-sintese.ts) e o filtro de estadia já respeita o mínimo.
 */
export const PROMESSA_ESTADIA = "Estadias de 30 a 180 dias (alguns imóveis pedem mínimo maior)";
