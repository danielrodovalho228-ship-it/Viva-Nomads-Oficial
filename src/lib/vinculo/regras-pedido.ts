/*
  Vínculo profissional — PRESERVAR O VÍNCULO ATUAL (ordem do Daniel, 02/11). Regras puras, sem banco:
  1) um pedido novo NUNCA apaga, substitui nem rebaixa o selo ativo (dominio + confirmado_em);
  2) recusa (código errado/bloqueado) ou expiração do pedido novo deixam o selo anterior como estava;
  3) o selo só troca quando a própria pessoa confirma o código do pedido novo.
  O pedido em andamento vive em `pedido_dominio` (0283); `dominio` só muda na confirmação.
*/
import { MAX_TENTATIVAS } from "./codigo.ts";

export interface LinhaVinculo {
  dominio: string;
  confirmado_em: string | null;
  pedido_dominio?: string | null;
}

/** O selo ativo da linha: o domínio confirmado, ou null. */
export function seloAtivo(l: LinhaVinculo | null | undefined): string | null {
  return l?.confirmado_em ? l.dominio : null;
}

/**
 * O que um pedido novo grava. Com selo ativo, NUNCA leva `dominio` nem `confirmado_em` (o selo fica intocado); sem selo,
 * `dominio` acompanha o pedido (a coluna não aceita nulo). `confirmado_em` nunca é escrito aqui.
 */
export function camposDoPedido(
  atual: LinhaVinculo | null,
  novoDominio: string,
  codigoHash: string,
  expiraEm: string,
): { pedido_dominio: string; codigo_hash: string; expira_em: string; tentativas: number; dominio?: string } {
  const base = { pedido_dominio: novoDominio, codigo_hash: codigoHash, expira_em: expiraEm, tentativas: 0 };
  return seloAtivo(atual) ? base : { ...base, dominio: novoDominio };
}

/** O domínio que o código em mãos confirma: o do pedido (linhas antigas, sem `pedido_dominio`: o próprio `dominio`). */
export function dominioDoPedido(l: LinhaVinculo): string {
  return l.pedido_dominio ?? l.dominio;
}

/** A troca explícita e confirmada pela pessoa: só aqui o selo passa a ser o domínio do pedido. */
export function camposDaConfirmacao(l: LinhaVinculo, agora: Date): { dominio: string; confirmado_em: string; pedido_dominio: null; tentativas: number } {
  return { dominio: dominioDoPedido(l), confirmado_em: agora.toISOString(), pedido_dominio: null, tentativas: MAX_TENTATIVAS };
}

/** Código errado: só a contagem de tentativas muda (nada do selo). */
export function camposDaRecusa(tentativas: number): { tentativas: number } {
  return { tentativas: tentativas + 1 };
}
