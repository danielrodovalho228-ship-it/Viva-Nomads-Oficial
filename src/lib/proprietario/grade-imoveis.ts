/**
 * Grade de imóveis da página do proprietário (varredura 20): as colunas do computador seguem a quantidade, para a
 * última linha não ficar com buraco. Até 4 imóveis: uma linha de 4. Acima disso, a primeira divisão exata entre 4, 3 e 5
 * colunas; sem divisão (7, 11…), 4 colunas como antes.
 */
export function colunasGradeImoveis(n: number): 3 | 4 | 5 {
  if (n <= 4) return 4;
  if (n === 5) return 5;
  for (const c of [4, 3, 5] as const) if (n % c === 0) return c;
  return 4;
}

const XL = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5" } as const;

/** Classes da grade (literais, para o Tailwind enxergá-las): 1 coluna no celular, 2 no tablet, N no computador. */
export function classeGradeImoveis(n: number): string {
  return `grid gap-4 sm:auto-rows-fr sm:grid-cols-2 ${XL[colunasGradeImoveis(n)]}`;
}
