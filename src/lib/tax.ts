/*
  Simulador tributário PF x PJ para locação (Atualização 2 — rodada 2).
  Base: Reforma Tributária / LC 214/2025 (EC 132/2023), que cria o IVA dual
  (IBS + CBS) sobre locação. NÃO é aconselhamento fiscal — é estimativa educativa.
*/

export type PersonType = "pf" | "pj";

// Alíquotas estimadas (espelham a aba Tributacao_PF_PJ da planilha). EXPORTADAS
// para a memória de cálculo (/tributario) declarar EXATAMENTE o que o simulador
// usa — fonte única: se a taxa muda aqui, a memória muda junto.

/**
 * IRPF da pessoa física sobre aluguel: carnê-leão MENSAL pela tabela
 * progressiva (vigente desde maio/2025): alíquota da faixa menos a parcela a
 * deduzir. Antes o simulador aplicava 27,5% sobre TODO o aluguel, o que
 * exagerava o imposto da PF e empurrava para a PJ.
 * NÃO inclui a redução da Lei 15.270/2025 para rendas mensais até R$ 7.350 —
 * nessa faixa o imposto real da PF pode ser ainda menor.
 */
export const IRPF_TABELA_MENSAL: { ate: number; aliquota: number; deducao: number }[] = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];
/** Alíquota MÁXIMA da tabela (só para referência na memória de cálculo). */
export const IRPF_RATE = 0.275;
export const IBS_CBS_RATE = 0.0183; // IBS+CBS sobre locação (estimativa da LC 214)
export const PJ_PRESUMIDO_RATE = 0.1088; // lucro presumido (locação) — já somado (IRPJ+adicional+CSLL+PIS/COFINS)
export const PJ_ACCOUNTING_YEAR = 5000; // custo estimado de contador/PJ por ano (só no limiar da recomendação)

/** IRPF de UM mês pelo carnê-leão (base = aluguel − despesas dedutíveis). */
export function irpfMensal(baseMensal: number): number {
  const base = Math.max(0, baseMensal);
  const faixa = IRPF_TABELA_MENSAL.find((f) => base <= f.ate) ?? IRPF_TABELA_MENSAL[IRPF_TABELA_MENSAL.length - 1];
  return Math.max(0, base * faixa.aliquota - faixa.deducao);
}

// Gatilhos cumulativos para a PF virar contribuinte de IBS/CBS.
export const PF_CONTRIBUTOR_MIN_PROPERTIES = 4; // "mais de 3 imóveis"
export const PF_CONTRIBUTOR_MIN_ANNUAL = 240000; // receita anual > R$ 240 mil

export interface TaxInput {
  monthlyRent: number; // receita de aluguel mensal (total da carteira)
  propertyCount: number; // nº de imóveis locados
  /**
   * Despesas pagas pelo PROPRIETÁRIO que a PF deduz do aluguel no carnê-leão
   * (IPTU, condomínio, taxa de administração), por mês. Padrão 0.
   */
  monthlyDeductions?: number;
}

export interface TaxResult {
  annualRevenue: number;
  /** PF é contribuinte de IBS/CBS? (regra cumulativa) */
  pfIsContributor: boolean;
  pfAnnualTax: number;
  /** Alíquota EFETIVA da PF (imposto anual ÷ aluguel anual). */
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

export function simulateTax({ monthlyRent, propertyCount, monthlyDeductions = 0 }: TaxInput): TaxResult {
  const aluguel = Math.max(0, monthlyRent);
  const annualRevenue = aluguel * 12;

  const pfIsContributor =
    propertyCount >= PF_CONTRIBUTOR_MIN_PROPERTIES && annualRevenue > PF_CONTRIBUTOR_MIN_ANNUAL;

  // PF: carnê-leão mês a mês pela tabela progressiva, sobre o aluguel menos as
  // despesas dedutíveis; IBS/CBS só se a PF for contribuinte.
  const deducoes = Math.min(Math.max(0, monthlyDeductions), aluguel);
  const irpfAno = irpfMensal(aluguel - deducoes) * 12;
  const ibsCbsPf = pfIsContributor ? annualRevenue * IBS_CBS_RATE : 0;
  const pfAnnualTax = Math.round(irpfAno + ibsCbsPf);
  const pfRate = annualRevenue > 0 ? pfAnnualTax / annualRevenue : 0; // alíquota EFETIVA
  const pjRate = PJ_PRESUMIDO_RATE + IBS_CBS_RATE;
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
