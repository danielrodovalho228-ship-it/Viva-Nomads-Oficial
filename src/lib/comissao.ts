import { comissaoSobreContrato } from "./cobranca/regra.ts";

/** Comissão de fechamento = valor total do contrato (aluguel × meses) × taxa da faixa. Cobrada do
 *  PROPRIETÁRIO, à parte — o aluguel nunca passa pela plataforma. Fórmula única em cobranca/regra.ts. */
export function valorComissao(aluguelMensal: number, meses: number, taxa: number): number {
  return comissaoSobreContrato(aluguelMensal, meses, taxa);
}

/** Valor total do contrato = aluguel mensal × meses contratados (base da comissão). Entrada inválida = 0. */
export function valorTotalContrato(aluguelMensal: number, meses: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(meses) || meses < 1) return 0;
  return Math.round(aluguelMensal * Math.floor(meses) * 100) / 100;
}
