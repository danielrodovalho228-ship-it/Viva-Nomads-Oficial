/**
 * Calculadora de viabilidade de mobiliar para temporada (Atualização 12).
 *
 * Compara a renda de um imóvel alugado "vazio" (long-term tradicional) com a
 * renda mobiliado por temporada de média duração, descontando o investimento
 * em mobília e os custos operacionais. Tudo client-side e determinístico.
 */

export interface ViabilityInput {
  emptyRent: number; // aluguel mensal alugando vazio (long-term)
  furnishedRent: number; // aluguel mensal mobiliado por temporada
  furnishingCost: number; // investimento em mobília/enxoval (uma vez)
  occupancyPct: number; // 0–100, ocupação média esperada no ano
  monthlyCosts: number; // custos operacionais mensais (limpeza, reposição, etc.)
}

export interface ViabilityResult {
  // Receita anual
  furnishedAnnualGross: number; // receita bruta mobiliado (ajustada pela ocupação)
  emptyAnnualGross: number; // receita bruta vazio (12 meses cheios)
  furnishedAnnualNet: number; // líquida mobiliado (após custos operacionais)
  annualUplift: number; // ganho líquido mobiliado − vazio (ano)
  // Indicadores do investimento em mobília
  marginPct: number; // margem líquida mobiliado (líquida / bruta)
  roiPct: number; // retorno anual sobre o investimento em mobília
  paybackMonths: number; // meses até o ganho extra pagar a mobília (Infinity se nunca)
  monthsOccupied: number; // meses-equivalentes ocupados no ano
}

export function computeViability(input: ViabilityInput): ViabilityResult {
  const occ = Math.min(100, Math.max(0, input.occupancyPct)) / 100;
  const monthsOccupied = 12 * occ;

  const furnishedAnnualGross = input.furnishedRent * monthsOccupied;
  const furnishedAnnualCosts = input.monthlyCosts * monthsOccupied;
  const furnishedAnnualNet = furnishedAnnualGross - furnishedAnnualCosts;

  // Vazio rende o ano inteiro (sem rotatividade), sem custos operacionais.
  const emptyAnnualGross = input.emptyRent * 12;

  const annualUplift = furnishedAnnualNet - emptyAnnualGross;

  const marginPct =
    furnishedAnnualGross > 0 ? (furnishedAnnualNet / furnishedAnnualGross) * 100 : 0;

  const roiPct =
    input.furnishingCost > 0 ? (annualUplift / input.furnishingCost) * 100 : 0;

  const monthlyUplift = annualUplift / 12;
  const paybackMonths =
    monthlyUplift > 0 ? input.furnishingCost / monthlyUplift : Infinity;

  return {
    furnishedAnnualGross,
    emptyAnnualGross,
    furnishedAnnualNet,
    annualUplift,
    marginPct,
    roiPct,
    paybackMonths,
    monthsOccupied,
  };
}
