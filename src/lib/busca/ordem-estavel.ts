/*
  E755 — a vitrine não troca de ordem entre carregamentos da mesma busca.
  Empate (mesma data de cadastro, mesma prioridade, mesmo preço) desempata SEMPRE pelo id: sem isso o Postgres e o
  sort devolvem a ordem de entrada, que muda entre consultas quando as linhas têm o mesmo created_at (lotes de massa).
*/
export function desempatePorId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
