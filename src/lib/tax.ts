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
/** Custo estimado de MANTER a empresa por ano (contador, taxas, certificado): entra na comparação PF × PJ (prompt 18). */
export const PJ_ACCOUNTING_YEAR = 5000;

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

/**
 * Aviso de IBS/CBS para a PF (prompt 18): só com a regra CUMULATIVA atendida (mais de 3 imóveis E receita anual
 * acima de R$ 240 mil), cobrança a partir de 2027 com base em 2026. O texto só vai ao ar depois da revisão do
 * Sérgio (ordem f74a8e59): até lá `AVISO_IBS_CBS_LIBERADO` fica desligado e a tela não mostra aviso nenhum.
 */
export const AVISO_IBS_CBS_LIBERADO = false;
export const AVISO_IBS_CBS_PF = {
  texto:
    "Com mais de 3 imóveis e receita acima de R$ 240 mil por ano, a pessoa física passa a pagar IBS/CBS sobre a locação. A cobrança começa em 2027, com base no que foi recebido em 2026. Procure um contador.",
  fonte: "Fontes: Barbieri Advogados e Renova Invest (artigos sobre a Reforma Tributária na locação), sob revisão.",
} as const;

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
  /**
   * Outros rendimentos tributáveis da pessoa por mês (salário, pró-labore…). O aluguel soma a eles na tabela
   * progressiva: o imposto atribuído ao aluguel é a DIFERENÇA (com − sem o aluguel). Padrão 0.
   */
  otherMonthlyIncome?: number;
}

export interface TaxResult {
  annualRevenue: number;
  /** PF é contribuinte de IBS/CBS? (regra cumulativa) */
  pfIsContributor: boolean;
  pfAnnualTax: number;
  /** Alíquota EFETIVA da PF (imposto anual ÷ aluguel anual). */
  pfRate: number;
  /** Imposto da empresa no lucro presumido (sem IBS/CBS: em 2026 é só a alíquota-teste compensável). */
  pjAnnualTax: number;
  pjRate: number;
  /** Custo de manter a empresa no ano. */
  pjAnnualCost: number;
  /** Diferença só de imposto (PF − PJ). */
  taxDifference: number;
  /** Vantagem REAL da PJ: imposto da PF − (imposto da PJ + custo de manter a empresa). Positivo = PJ compensa. */
  taxSavings: number;
  /** Recomendação: PJ só quando a vantagem real é positiva. */
  recommendation: PersonType;
  /** Mostrar o aviso de IBS/CBS (regra cumulativa da PF). A tela também depende de AVISO_IBS_CBS_LIBERADO. */
  ibsCbsAviso: boolean;
}

export function simulateTax({ monthlyRent, propertyCount, monthlyDeductions = 0, otherMonthlyIncome = 0 }: TaxInput): TaxResult {
  const aluguel = Math.max(0, monthlyRent);
  const annualRevenue = aluguel * 12;

  const pfIsContributor =
    propertyCount >= PF_CONTRIBUTOR_MIN_PROPERTIES && annualRevenue > PF_CONTRIBUTOR_MIN_ANNUAL;

  // PF: carnê-leão mês a mês pela tabela progressiva, sobre o aluguel menos as
  // despesas dedutíveis; IBS/CBS só se a PF for contribuinte.
  const deducoes = Math.min(Math.max(0, monthlyDeductions), aluguel);
  const outros = Math.max(0, otherMonthlyIncome);
  const irpfAno = (irpfMensal(outros + aluguel - deducoes) - irpfMensal(outros)) * 12;
  const ibsCbsPf = pfIsContributor ? annualRevenue * IBS_CBS_RATE : 0;
  const pfAnnualTax = Math.round(irpfAno + ibsCbsPf);
  const pfRate = annualRevenue > 0 ? pfAnnualTax / annualRevenue : 0; // alíquota EFETIVA
  const pjRate = PJ_PRESUMIDO_RATE;
  const pjAnnualTax = Math.round(annualRevenue * pjRate);
  const pjAnnualCost = annualRevenue > 0 ? PJ_ACCOUNTING_YEAR : 0;
  const taxDifference = pfAnnualTax - pjAnnualTax;
  const taxSavings = taxDifference - pjAnnualCost;

  // PJ só compensa quando a economia de imposto supera o custo de manter a empresa.
  const recommendation: PersonType = taxSavings > 0 ? "pj" : "pf";

  return {
    annualRevenue,
    pfIsContributor,
    pfAnnualTax,
    pfRate,
    pjAnnualTax,
    pjRate,
    pjAnnualCost,
    taxDifference,
    taxSavings,
    recommendation,
    ibsCbsAviso: pfIsContributor,
  };
}
