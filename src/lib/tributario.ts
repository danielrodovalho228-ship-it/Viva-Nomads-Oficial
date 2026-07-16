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
  IRPF_RATE,
  IBS_CBS_RATE,
  PJ_PRESUMIDO_RATE,
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
    rotulo: "Alíquota de IRPF aplicada",
    valor: `${pct(IRPF_RATE)} (única, sobre a receita bruta)`,
    status: "implicito",
    nota:
      "O cálculo usa a faixa SUPERIOR do IRPF como alíquota única — NÃO há tabela " +
      "progressiva, parcela a deduzir nem mecânica mensal do carnê-leão. Isso " +
      "PROVAVELMENTE SUPERESTIMA o imposto da PF em rendas moderadas (a pergunta nº 1 do parecer).",
  },
  {
    chave: "pf_deducoes",
    rotulo: "Deduções da PF (condomínio, IPTU, manutenção)",
    valor: "nenhuma",
    status: "implicito",
    nota: "O código não deduz custos do locador na PF — confirmar se é aceitável para um simulador educativo.",
  },
  {
    chave: "pf_ibs_cbs",
    rotulo: "PF vira contribuinte de IBS/CBS quando",
    valor: `${PF_CONTRIBUTOR_MIN_PROPERTIES}+ imóveis E receita anual > ${brl(PF_CONTRIBUTOR_MIN_ANNUAL)}`,
    status: "confirmado",
    nota: `Regra cumulativa. Ao disparar, soma ${pct(IBS_CBS_RATE)} à carga da PF.`,
  },
];

/** Premissas do cenário PJ (pessoa jurídica). */
export const PREMISSAS_PJ: Premissa[] = [
  {
    chave: "pj_presumido",
    rotulo: "Carga da PJ sobre a receita",
    valor: `${pct(PJ_PRESUMIDO_RATE)} (pré-somada) + ${pct(IBS_CBS_RATE)} de IBS/CBS`,
    status: "implicito",
    nota:
      "A alíquota da PJ vem PRÉ-SOMADA (não há decomposição de presunção %, IRPJ, " +
      "adicional, CSLL, PIS/COFINS). Confirmar o regime (Lucro Presumido?) e cada componente.",
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
  valor: `${pct(IBS_CBS_RATE)} (estimativa única)`,
  status: "implicito",
  nota:
    "Número único estimado — o simulador NÃO modela o cronograma de transição nem os " +
    "critérios de incidência por regulamentação. Espaço para as conclusões do parecer.",
};

/** Perguntas abertas para o parecer do Vinicius (seção 7 do documento). */
export const PERGUNTAS_PARECER: string[] = [
  "A tabela de IRPF e a mecânica do carnê-leão estão corretas? (hoje é alíquota única — superestima?)",
  "O regime e as alíquotas do cenário PJ estão corretos para locação de imóvel próprio?",
  "As simplificações são aceitáveis para um simulador EDUCATIVO?",
  "O disclaimer exibido ao usuário é suficiente?",
  "O que a LC 214 muda nos dois cenários — e a partir de quando?",
  "Recomendações de ajuste (fórmulas, textos, novos avisos).",
];
