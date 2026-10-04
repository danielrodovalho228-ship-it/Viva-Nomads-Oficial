/**
 * MEMÓRIA DE CÁLCULO do simulador tributário PF × PJ (fonte única para a página
 * interna /tributario). Não duplica fórmula: re-exporta a função REAL do
 * simulador e declara as PREMISSAS a partir das MESMAS constantes que o cálculo
 * usa. Se `lib/tax.ts` mudar uma taxa, esta memória muda junto — a página é
 * incapaz de divergir do produto.
 *
 * As premissas marcadas como "implicito" são o que o parecer do Vinicius precisa
 * confirmar (o código assume sem declarar — ex.: PF sem deduções, PJ pré-somada).
 */
import {
  simulateTax,
  IBS_CBS_TESTE_2026,
  PJ_PRESUMIDO_RATE,
  REDUTOR_LEI_15270,
  PJ_ACCOUNTING_YEAR,
  PF_CONTRIBUTOR_MIN_PROPERTIES,
  PF_CONTRIBUTOR_MIN_ANNUAL,
} from "./tax.ts";

export { simulateTax };
export type { TaxInput, TaxResult, PersonType } from "./tax.ts";

export type StatusPremissa = "confirmado" | "implicito";

export interface Premissa {
  chave: string;
  rotulo: string;
  /** Valor lido DIRETO do código (fonte única). */
  valor: string;
  status: StatusPremissa;
  nota: string;
}

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/** Premissas do cenário PF (pessoa física). */
export const PREMISSAS_PF: Premissa[] = [
  {
    chave: "irpf_rate",
    rotulo: "IRPF da PF",
    valor: "tabela progressiva mensal do carnê-leão (0% a 27,5%, com parcela a deduzir) + redutor da Lei 15.270/2025",
    status: "confirmado",
    nota:
      "Calculado mês a mês: aluguel do mês (menos as despesas dedutíveis) × alíquota da " +
      "faixa − parcela a deduzir; depois o redutor mensal: rendimento até " +
      `${brl(REDUTOR_LEI_15270.isencaoAte)} → imposto zero; de ${brl(REDUTOR_LEI_15270.isencaoAte)} a ` +
      `${brl(REDUTOR_LEI_15270.faixaAte)} → redução de R$ 978,62 − 0,133145 × rendimento; ` +
      `acima, sem redução. × 12. Fonte: ${REDUTOR_LEI_15270.fonte}.`,
  },
  {
    chave: "pf_deducoes",
    rotulo: "Deduções da PF (IPTU, condomínio, taxa de administração)",
    valor: "informadas pelo proprietário (padrão: nenhuma)",
    status: "confirmado",
    nota: "Despesas pagas pelo proprietário saem da base do carnê-leão antes da tabela.",
  },
  {
    chave: "pf_ibs_cbs",
    rotulo: "PF vira contribuinte de IBS/CBS quando",
    valor: `${PF_CONTRIBUTOR_MIN_PROPERTIES}+ imóveis E receita anual > ${brl(PF_CONTRIBUTOR_MIN_ANNUAL)}`,
    status: "confirmado",
    nota:
      `Regra cumulativa. Em 2026 o IBS/CBS é só a alíquota-teste de ${pct(IBS_CBS_TESTE_2026)}, ` +
      "compensável com PIS/COFINS — custo líquido zero; a carga plena da transição (2027+) não é modelada.",
  },
];

/** Premissas do cenário PJ (pessoa jurídica). */
export const PREMISSAS_PJ: Premissa[] = [
  {
    chave: "pj_presumido",
    rotulo: "Carga da PJ sobre a receita",
    valor: `${pct(PJ_PRESUMIDO_RATE)} da receita (lucro presumido de locação)`,
    status: "confirmado",
    nota:
      "Presunção de 32%: IRPJ 15% × 32% = 4,80% + CSLL 9% × 32% = 2,88% + PIS 0,65% + " +
      "COFINS 3% = 11,33%. O adicional de IRPJ (10% acima de R$ 20 mil/mês de lucro " +
      "presumido) só pesa em carteiras grandes e não entra.",
  },
  {
    chave: "pj_custos_ignorados",
    rotulo: "Custos da PJ ignorados no imposto",
    valor: "contador, ITBI na integralização, ganho de capital, distribuição, pró-labore",
    status: "implicito",
    nota: `Só um custo anual estimado de ${brl(PJ_ACCOUNTING_YEAR)} entra — e apenas no LIMIAR da recomendação PF×PJ, não no imposto.`,
  },
];

/** Premissa comum (IBS/CBS) — reforma tributária. */
export const PREMISSA_IBS_CBS: Premissa = {
  chave: "ibs_cbs",
  rotulo: "IBS/CBS (LC 214/2025)",
  valor: `2026: alíquota-teste de ${pct(IBS_CBS_TESTE_2026)} (CBS 0,9% + IBS 0,1%), compensável — custo líquido zero`,
  status: "implicito",
  nota:
    "Em 2026 o tributo é só destacado na nota e compensado com PIS/COFINS. O simulador " +
    "NÃO modela a transição (2027+) nem os redutores específicos de locação — confirmar no parecer.",
};

/** Perguntas abertas para o parecer do Vinicius (seção 7 do documento). */
export const PERGUNTAS_PARECER: string[] = [
  "A tabela progressiva do carnê-leão com o redutor da Lei 15.270/2025 está correta para aluguel?",
  "O regime e as alíquotas do cenário PJ estão corretos para locação de imóvel próprio?",
  "As simplificações são aceitáveis para um simulador EDUCATIVO?",
  "O disclaimer exibido ao usuário é suficiente?",
  "O que a LC 214 muda nos dois cenários — e a partir de quando?",
  "Recomendações de ajuste (fórmulas, textos, novos avisos).",
];
