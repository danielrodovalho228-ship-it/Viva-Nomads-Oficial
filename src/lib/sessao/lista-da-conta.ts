/*
  E680 — uma lista de estadias pertence a UMA conta. O servidor monta a lista para a sessão do pedido; se o navegador já
  está com outra conta (troca de conta, página guardada, resposta atrasada de antes da troca), a lista que chegou não é
  dele e não pode aparecer, nem por um instante. Pura (node --test).
*/
export function soDaConta<T extends { paraUsuario?: string }>(itens: T[], usuarioDoNavegador: string | null | undefined): T[] {
  if (!usuarioDoNavegador) return itens; // o navegador ainda não sabe quem é: vale a lista da sessão do pedido
  return itens.filter((i) => i.paraUsuario === usuarioDoNavegador);
}
