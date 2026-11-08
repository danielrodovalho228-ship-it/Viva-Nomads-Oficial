/*
  E696 — a fórmula do total da estadia no cartão de preço. A conta vem de uma frase só ("R$ 3.960 × 43 dias ÷ 30 (1 mês + 13 dias)
  + limpeza de preparação R$ 450 + limpeza de saída R$ 250 = R$ 6.376"); numa coluna estreita ela quebrava no meio do total.
  Aqui ela vira uma parcela por linha e o total sozinho, para a tela mostrar o número inteiro sempre. Puro.
*/
export interface FormulaEmLinhas {
  parcelas: string[];
  total: string | null;
}

/**
 * Separa a conta em parcelas (no " + " que abre uma parcela com texto; o "+" do período, como em "1 mês + 13 dias", tem
 * número depois e fica) e tira o "= total" do fim. `total` explícito vence o que vier na frase.
 */
export function partirFormula(conta: string | null | undefined, total?: string | null): FormulaEmLinhas {
  let texto = (conta ?? "").trim();
  let fim: string | null = total ?? null;
  const i = texto.lastIndexOf(" = ");
  if (i >= 0) {
    fim = fim ?? texto.slice(i + 3).trim();
    texto = texto.slice(0, i).trim();
  }
  const parcelas = texto ? texto.split(/ \+ (?=[^\d\s])/).map((p) => p.trim()).filter(Boolean) : [];
  return { parcelas, total: fim };
}
