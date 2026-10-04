/** Comissão de fechamento = 1 aluguel × taxa, em reais inteiros. Cobrada do
 *  PROPRIETÁRIO, à parte — o aluguel nunca passa pela plataforma. */
export function valorComissao(aluguelMensal: number, taxa: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(taxa) || taxa <= 0) return 0;
  return Math.round(aluguelMensal * taxa);
}
