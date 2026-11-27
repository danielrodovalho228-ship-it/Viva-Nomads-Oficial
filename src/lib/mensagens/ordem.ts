/*
  E481 — a lista de Mensagens em ordem de atividade recente (a conversa com a mensagem mais nova primeiro). PURO.
*/

/** Quando foi a última mensagem da conversa (ISO), ou null se ainda não há mensagem. */
export function ultimaAtividade(c: { messages: { enviadaEm?: string }[] }): string | null {
  let ultima: string | null = null;
  for (const m of c.messages) if (m.enviadaEm && (!ultima || m.enviadaEm > ultima)) ultima = m.enviadaEm;
  return ultima;
}

/** A mais recente primeiro; conversa sem mensagem (contrato/candidatura ainda sem conversa) no fim, na ordem de antes. */
export function ordenarPorAtividade<T extends { messages: { enviadaEm?: string }[] }>(conversas: T[]): T[] {
  return conversas
    .map((c, i) => ({ c, i, em: ultimaAtividade(c) }))
    .sort((a, b) => (a.em && b.em ? (a.em < b.em ? 1 : a.em > b.em ? -1 : a.i - b.i) : a.em ? -1 : b.em ? 1 : a.i - b.i))
    .map((x) => x.c);
}
