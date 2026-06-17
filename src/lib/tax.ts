/*
  Simulador tributário PF x PJ para locação (Atualização 2 — rodada 2).
  Base: Reforma Tributária / LC 214/2025 (EC 132/2023), que cria o IVA dual
  (IBS + CBS) sobre locação. NÃO é aconselhamento fiscal — é estimativa educativa.
*/

export type PersonType = "pf" | "pj";

// Alíquotas estimadas (espelham a aba Tributacao_PF_PJ da planilha).
const IRPF_RATE = 0.275; // IRPF (faixa superior, carnê-leão)
const IBS_CBS_RATE = 0.0183; // IBS+CBS sobre locação
const PJ_PRESUMIDO_RATE = 0.1088; // lucro presumido (locação)
const PJ_ACCOUNTING_YEAR = 5000; // custo estimado de contador/PJ por ano

// Gatilhos cumulativos para a PF virar contribuinte de IBS/CBS.
const PF_CONTRIBUTOR_MIN_PROPERTIES = 4; // "mais de 3 imóveis"
const PF_CONTRIBUTOR_MIN_ANNUAL = 240000; // receita anual > R$ 240 mil

export interface TaxInput {
  monthlyRent: number; // receita de aluguel mensal (total da carteira)
  propertyCount: number; // nº de imóveis locados
}

export interface TaxResult {
  annualRevenue: number;
  /** PF é contribuinte de IBS/CBS? (regra cumulativa) */
  pfIsContributor: boolean;
  pfAnnualTax: number;
  pfRate: number;
  pjAnnualTax: number; // já inclui IBS/CBS
  pjRate: number;
  /** Economia anual (tributo PF − tributo PJ). Positivo = PJ paga menos. */
  taxSavings: number;
  /** Recomendação considerando o custo de manter PJ. */
  recommendation: PersonType;
  /** PJ (ou PF contribuinte) precisa emitir NFS-e com CBS/IBS (a partir de ago/2026). */
  needsNfse: boolean;
}

export function simulateTax({ monthlyRent, propertyCount }: TaxInput): TaxResult {
  const annualRevenue = Math.max(0, monthlyRent) * 12;

  const pfIsContributor =
    propertyCount >= PF_CONTRIBUTOR_MIN_PROPERTIES && annualRevenue > PF_CONTRIBUTOR_MIN_ANNUAL;

  const pfRate = IRPF_RATE + (pfIsContributor ? IBS_CBS_RATE : 0);
  const pjRate = PJ_PRESUMIDO_RATE + IBS_CBS_RATE;

  const pfAnnualTax = Math.round(annualRevenue * pfRate);
  const pjAnnualTax = Math.round(annualRevenue * pjRate);
  const taxSavings = pfAnnualTax - pjAnnualTax;

  // PJ só compensa quando a economia tributária supera o custo de mantê-la.
  const recommendation: PersonType = taxSavings > PJ_ACCOUNTING_YEAR ? "pj" : "pf";

  return {
    annualRevenue,
    pfIsContributor,
    pfAnnualTax,
    pfRate,
    pjAnnualTax,
    pjRate,
    taxSavings,
    recommendation,
    needsNfse: recommendation === "pj" || pfIsContributor,
  };
}
