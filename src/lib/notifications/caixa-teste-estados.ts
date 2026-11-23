/**
 * E1134 (ORDEM-DUET-589): o que a Caixa de e-mails de teste (Conta › Ajuda) mostra em cada momento. Parte pura.
 * "Não li" não é "não tem": enquanto a busca corre e quando ela falha, a conta de teste vê isso escrito. A conta real
 * (ou a que a tela ainda não sabe se é de teste) não vê nada: a caixa é superfície só de contas de teste.
 */

/** A busca da rota /api/conta/caixa-teste: a correr, falhada, ou lida (`emails: null` = o servidor diz "conta real"). */
export type LeituraDaCaixa<E> = { fase: "buscando" } | { fase: "falhou" } | { fase: "lida"; emails: E[] | null };

export type VistaDaCaixa<E> = { tipo: "nada" } | { tipo: "carregando" } | { tipo: "erro" } | { tipo: "lista"; emails: E[] };

export const TEXTO_CAIXA_CARREGANDO = "Carregando os e-mails…";
export const TEXTO_CAIXA_NAO_LIDA = "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia.";

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
  return leitura.fase === "buscando" ? { tipo: "carregando" } : { tipo: "erro" };
}
