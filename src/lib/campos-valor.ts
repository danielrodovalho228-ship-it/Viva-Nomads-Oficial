/*
  Teto dos campos de valor das ferramentas (simulador, ROI, tributário). Sem
  teto, R$ 99.999.999/mês passava sem aviso e o resultado não fazia sentido.
  Módulo puro.
*/

/** Aluguel mensal de UM imóvel (mobiliado ou não). */
export const MAX_ALUGUEL_MENSAL = 100_000;
/** Receita mensal de uma CARTEIRA de imóveis (simulador tributário). */
export const MAX_RECEITA_CARTEIRA = 2_000_000;
/** Investimento/custo pontual (mobília, reforma). */
export const MAX_INVESTIMENTO = 2_000_000;

/** Valor dentro de [0, max]; NaN/negativo → 0. */
export function limitar(v: number, max: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, max);
}

/** Aviso para a tela quando o valor digitado passou do teto (ou null). */
export function avisoTeto(v: number, max: number): string | null {
  return Number.isFinite(v) && v > max
    ? `Valor acima do máximo aceito (R$ ${max.toLocaleString("pt-BR")}). Usamos o máximo no cálculo.`
    : null;
}
