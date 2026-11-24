/**
 * E1134 (ORDEM-DUET-589): o que a Caixa de e-mails de teste (Conta › Ajuda) mostra em cada momento. Parte pura.
 * "Não li" não é "não tem": enquanto a busca corre e quando ela falha, a conta de teste vê isso escrito. A conta real
 * (ou a que a tela ainda não sabe se é de teste) não vê nada: a caixa é superfície só de contas de teste.
 */

/** A busca da rota /api/conta/caixa-teste: a correr, falhada, ou lida (`emails: null` = o servidor diz "conta real"). */
export type LeituraDaCaixa<E> = { fase: "buscando"; demorada?: boolean } | { fase: "falhou" } | { fase: "lida"; emails: E[] | null };

export type VistaDaCaixa<E> = { tipo: "nada" } | { tipo: "carregando"; demorada?: true } | { tipo: "erro" } | { tipo: "lista"; emails: E[] };

export const TEXTO_CAIXA_CARREGANDO = "Carregando os e-mails…";
export const TEXTO_CAIXA_NAO_LIDA = "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia.";
/** E1136: a busca passou de CAIXA_DEMORA_MS e ainda corre. Vai ao lado de "Carregando os e-mails…", com "Tentar de novo". */
export const TEXTO_CAIXA_DEMORADA = "Está demorando mais que o normal.";

/** E1136: a partir daqui o carregamento diz que demora e oferece "Tentar de novo". */
export const CAIXA_DEMORA_MS = 5_000;
/** E1136: o limite da busca. Passou, a tela corta o pedido e mostra "não li" (antes: "carregando" para sempre). */
export const CAIXA_LIMITE_MS = 15_000;

/**
 * E1136 (silêncio duplo): quem sabe se a conta é de teste. A página lê no servidor e manda (true ou false). Só quando o
 * servidor não leu (null) ou a página não disse nada (undefined) é que vale a sessão do navegador, que pode ter
 * desistido de ler o perfil e ficado em "conta real".
 */
export function contaDeTesteSabida(servidor: boolean | null | undefined, sessao: boolean | undefined): boolean | undefined {
  return typeof servidor === "boolean" ? servidor : sessao;
}

/**
 * A resposta da rota como leitura. Só um 200 com `emails` (lista ou null) conta como lido; qualquer outro estado ou
 * corpo é "não li" (antes: a tela ficava em branco para sempre).
 */
export function leituraDaResposta<E>(ok: boolean, corpo: unknown): LeituraDaCaixa<E> {
  if (!ok || typeof corpo !== "object" || corpo === null || !("emails" in corpo)) return { fase: "falhou" };
  const emails = (corpo as { emails: unknown }).emails;
  if (emails === null) return { fase: "lida", emails: null };
  return Array.isArray(emails) ? { fase: "lida", emails: emails as E[] } : { fase: "falhou" };
}

/**
 * O que desenhar. A resposta lida do servidor manda (lista, ou nada se a conta não é de teste). Sem resposta lida, só
 * a conta que a sessão já sabe ser de teste (`contaDeTeste === true`) vê "carregando" ou o erro.
 */
export function vistaDaCaixa<E>(contaDeTeste: boolean | undefined, leitura: LeituraDaCaixa<E>): VistaDaCaixa<E> {
  if (leitura.fase === "lida") return leitura.emails ? { tipo: "lista", emails: leitura.emails } : { tipo: "nada" };
  if (contaDeTeste !== true) return { tipo: "nada" };
  if (leitura.fase === "falhou") return { tipo: "erro" };
  return leitura.demorada ? { tipo: "carregando", demorada: true } : { tipo: "carregando" };
}
