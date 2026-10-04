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
 * deduzir, e depois o REDUTOR da Lei 15.270/2025 (vigente em 2026), que também
 * vale para o carnê-leão: rendimento até R$ 5.000/mês → imposto zero; de
 * R$ 5.000,01 a R$ 7.350 → redução decrescente.
 */
export const IRPF_TABELA_MENSAL: { ate: number; aliquota: number; deducao: number }[] = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];
/**
 * Redutor mensal da Lei 15.270/2025 (art. 3º-A da Lei 9.250/95):
 * • rendimento tributável mensal até R$ 5.000,00 → imposto reduzido a zero;
 * • de R$ 5.000,01 a R$ 7.350,00 → redução = R$ 978,62 − 0,133145 × rendimento;
 * • acima de R$ 7.350,00 → sem redução.
 * Fonte: Lei nº 15.270, de 26/11/2025 (DOU 27/11/2025).
 */
export const REDUTOR_LEI_15270 = {
  isencaoAte: 5000,
  faixaAte: 7350,
  constante: 978.62,
  fator: 0.133145,
  fonte: "Lei nº 15.270/2025 (redutor mensal do IRPF, vigente desde jan/2026)",
} as const;
/** Alíquota MÁXIMA da tabela (só para referência na memória de cálculo). */
export const IRPF_RATE = 0.275;
/**
 * IBS/CBS em 2026: só a ALÍQUOTA-TESTE de 1% (CBS 0,9% + IBS 0,1%), destacada
 * na nota e COMPENSÁVEL com PIS/COFINS — custo líquido zero no ano de teste.
 * O simulador soma o custo LÍQUIDO (0); a cobrança plena vem na transição
 * (2027+), ainda não modelada.
 */
export const IBS_CBS_TESTE_2026 = 0.01;
export const IBS_CBS_RATE = 0; // custo líquido em 2026 (teste compensável)
/**
 * Lucro presumido sobre locação de imóvel próprio, sobre a receita:
 * IRPJ 15% × 32% (4,80%) + CSLL 9% × 32% (2,88%) + PIS 0,65% + COFINS 3% =
 * 11,33%. O adicional de IRPJ (10% sobre o que passar de R$ 20 mil/mês de
 * presunção) só pesa para carteiras grandes e não entra aqui.
 */
export const PJ_PRESUMIDO_RATE = 0.1133;
export const PJ_ACCOUNTING_YEAR = 5000; // custo estimado de contador/PJ por ano (só no limiar da recomendação)

/** IRPF de UM mês pela tabela, SEM o redutor (exportado para a memória). */
export function irpfMensalTabela(baseMensal: number): number {
  const base = Math.max(0, baseMensal);
  const faixa = IRPF_TABELA_MENSAL.find((f) => base <= f.ate) ?? IRPF_TABELA_MENSAL[IRPF_TABELA_MENSAL.length - 1];
  return Math.max(0, base * faixa.aliquota - faixa.deducao);
}

/** Redução da Lei 15.270/2025 para um rendimento mensal (limitada ao imposto). */
export function redutorLei15270(rendimentoMensal: number, impostoTabela: number): number {
  const r = Math.max(0, rendimentoMensal);
  if (r <= REDUTOR_LEI_15270.isencaoAte) return impostoTabela;
  if (r <= REDUTOR_LEI_15270.faixaAte) {
    const reducao = REDUTOR_LEI_15270.constante - REDUTOR_LEI_15270.fator * r;
    return Math.min(impostoTabela, Math.max(0, reducao));
  }
  return 0;
}

/** IRPF de UM mês pelo carnê-leão (base = aluguel − despesas dedutíveis), já com o redutor. */
export function irpfMensal(baseMensal: number): number {
  const tabela = irpfMensalTabela(baseMensal);
  return Math.max(0, tabela - redutorLei15270(baseMensal, tabela));
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
