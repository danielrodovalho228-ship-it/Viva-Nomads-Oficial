/*
  E227-B — parceria tem UMA fila: parceiro_solicitacoes (0190). Na aba "Pendentes" de /admin/parceiros cada pedido
  mostra há quantos dias espera, do mais antigo para o mais novo. Sem situações novas: aprovar ou recusar basta.
  Roda: node --test src/lib/parceiros/fila-pendentes.test.ts
*/

const DIA_MS = 86_400_000;

/** Dias inteiros desde o pedido (nunca negativo; data inválida conta como hoje). */
export function diasNaFila(criadoEm: string, agora: Date): number {
  const t = Date.parse(criadoEm);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - t) / DIA_MS));
}

/** "hoje", "há 1 dia", "há N dias". */
export function textoHaDias(n: number): string {
  if (n <= 0) return "hoje";
  return n === 1 ? "há 1 dia" : `há ${n} dias`;
}

/** Do mais antigo para o mais novo (empate: id, para a ordem não pular entre recargas). */
export function ordenarPendentes<T extends { criado_em: string; id: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em) || a.id.localeCompare(b.id));
}
