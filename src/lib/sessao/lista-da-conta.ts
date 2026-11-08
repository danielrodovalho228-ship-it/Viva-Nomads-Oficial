/*
  E680 — uma lista de estadias pertence a UMA conta. O servidor monta a lista para a sessão do pedido; se o navegador já
  está com outra conta (troca de conta, página guardada, resposta atrasada de antes da troca), a lista que chegou não é
  dele e não pode aparecer, nem por um instante. Pura (node --test).

  RESÍDUO (lista POPULADA): a identidade do store (`user`) é PERSISTIDA (localStorage "vivanomads-auth") — logo, logo depois
  de uma troca de conta ela ainda pode ser a da conta ANTERIOR. Comparar a lista com ela só prova que "a lista é da conta
  que estava gravada", não da que está logada. Por isso o cartão só vale a identidade depois do `authChecked`, que não é
  persistido e recomeça `false` a cada carga: ele só vira `true` quando a sessão REAL foi lida (setUser/clear). Antes
  disso, a lista populada não aparece.
*/

/** A conta que o navegador CONFIRMOU (sessão real lida nesta carga); antes disso, nenhuma. */
export function contaConfirmada(s: { user?: { id?: string } | null; authChecked?: boolean }): string | null {
  return s.authChecked === true && s.user?.id ? s.user.id : null;
}

/** Só os itens da conta confirmada no navegador; sem conta confirmada, nada. */
export function soDaConta<T extends { paraUsuario?: string }>(itens: T[], contaDoNavegador: string | null | undefined): T[] {
  if (!contaDoNavegador) return [];
  return itens.filter((i) => i.paraUsuario === contaDoNavegador);
}
