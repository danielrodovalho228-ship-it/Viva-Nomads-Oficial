/*
  E1163 (ORDENS-DUET 684 e 685) — a conta das três filas da avaliação que esperam a equipe: pedido sem avaliador
  elegível, laudo atrasado e credenciamento para decidir. Regra PURA (testada em e1163-contagens-da-central.test.ts);
  quem lê o banco é src/lib/data/avaliadores-contagens.ts, a fonte ÚNICA da Central e da página dos avaliadores.

  As contas de teste ficam fora do número (a regra da casa para todo número que a equipe lê) e aparecem à parte.
*/

/** O resultado de uma fila: o número, o detalhe e as linhas — as que contam e as de conta de teste, à parte. */
export type ContagemDaCentral<T> = {
  /** Quantas contam (contas de teste fora). É sempre `reais.length`: número = lista. */
  n: number;
  /** Desde quando espera a mais antiga das que contam (ISO); null sem nenhuma, ou sem data. */
  maisAntigoEm: string | null;
  reais: T[];
  deTeste: T[];
};

/**
 * Separa as linhas de conta de teste e conta as outras.
 * `conta`: de quem é a linha (o dono do pedido, a conta do credenciamento). Linha sem conta conhecida conta como real:
 * some do número só o que se sabe ser de teste.
 */
export function separarContasDeTeste<T>(
  linhas: readonly T[],
  conta: (linha: T) => string | null | undefined,
  desde: (linha: T) => string | null | undefined,
  contasDeTeste: ReadonlySet<string>,
): ContagemDaCentral<T> {
  const reais: T[] = [];
  const deTeste: T[] = [];
  for (const l of linhas) {
    const c = conta(l);
    if (c && contasDeTeste.has(c)) deTeste.push(l);
    else reais.push(l);
  }
  const datas = reais.map((l) => desde(l)).filter((d): d is string => !!d && Number.isFinite(Date.parse(d)));
  const maisAntigoEm = datas.length ? datas.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a)) : null;
  return { n: reais.length, maisAntigoEm, reais, deTeste };
}

/** O que a página diz por cima das linhas de conta de teste, que ficam fora do número (texto aprovado na ORDEM-706). */
export function textoDasContasDeTeste(n: number): string {
  return `Mais ${n} de conta de teste, fora do número:`;
}
