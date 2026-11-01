/*
  E294 — cálculo ÚNICO do imóvel (funde o Simulador de rentabilidade e a Calculadora de ROI). "A Viva só conecta"
  (diretriz do Daniel de 31/10): todo número da conta é o que o dono digitou. Nada de padrão de mercado nem de valor
  de exemplo — campo vazio vale 0, e sem valor mensal e meses ocupados não há resultado. A única coisa que vem da
  Viva é a taxa de serviço da faixa (o preço dela, pela regra única de cobranca/regra.ts).
  As contas são as MESMAS de antes (lib/simulador.ts): o mobiliado sai de liquidoMobiliadoAnual (rentabilidade e
  comparação usam a mesma base) e o tradicional de liquidoTradicionalAnual, sempre com os números do dono.
*/
import {
  contratosPorAno,
  simularROI,
  simularRentabilidade,
  type Cobranca,
  type ResultadoRentabilidade,
  type ResultadoROI,
} from "./simulador.ts";

export interface TradicionalDigitado {
  /** Valor mensal do contrato tradicional, sem mobília (R$). Sem ele (0), não há comparação. */
  valorMensal: number;
  /** Meses vazios por ano no tradicional (0..12). */
  mesesVazios: number;
  /** Taxa de administração da imobiliária (%, 0..100). */
  taxaAdmPct: number;
  /** 1 valor mensal de intermediação a cada N meses de contrato; 0 = a imobiliária não cobra. */
  intermediacaoACadaMeses: number;
}

export interface EntradaImovel {
  valorMensal: number;
  condoIptu: number;
  condoCobranca: Cobranca;
  contas: number;
  contasCobranca: Cobranca;
  /** Meses ocupados no ano (1..12). */
  mesesOcupados: number;
  /** Prazo médio por contrato (meses); 0 = não informado (só some a estimativa de contratos por ano). */
  prazoMedioMeses: number;
  /** Valor do imóvel (R$), opcional: rentabilidade sobre o imóvel. */
  valorImovel: number;
  /** Investimento na mobília (R$): base da reposição, do payback e do ROI. */
  investimentoMobilia: number;
  /** Reposição e desgaste da mobília (% do investimento por ano, 0..100). */
  reposicaoPct: number;
  tradicional: TradicionalDigitado;
  /** Rendimento anual se o investimento ficasse aplicado (%, 0..100); 0 = não comparar. */
  rendimentoPct: number;
}

export interface CenarioCalculado {
  nome: string;
  mesesOcupados: number;
  liquidaAnual: number;
  ganhoAdicionalAnual: number | null;
}

export interface ResultadoImovel {
  /** Há o mínimo para calcular: valor mensal e meses ocupados digitados. */
  pronto: boolean;
  rentabilidade: ResultadoRentabilidade;
  /** Contratos por ano, só com o prazo médio informado. */
  contratosPorAno: number | null;
  /** Comparação com o tradicional: só com o valor mensal do tradicional digitado. */
  comparacao: ResultadoROI | null;
  cenarios: CenarioCalculado[];
}

/** Cenários a partir do número do dono: 2 meses a menos, o dele e 2 a mais, dentro de 1..12 (o campo aceita 1..12). */
export function cenariosDoDono(mesesOcupados: number): { nome: string; mesesOcupados: number }[] {
  const m = Math.min(12, Math.max(1, Math.round(mesesOcupados)));
  return [
    { nome: "Conservador", mesesOcupados: Math.max(1, m - 2) },
    { nome: "Realista", mesesOcupados: m },
    { nome: "Otimista", mesesOcupados: Math.min(12, m + 2) },
  ];
}

const num = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
const pct = (v: number) => Math.min(1, num(v) / 100);

/** Uma entrada vazia: tudo 0 (cobranças "à parte", o caso comum, que não acrescenta custo nenhum). */
export function entradaVazia(): EntradaImovel {
  return {
    valorMensal: 0,
    condoIptu: 0,
    condoCobranca: "aparte",
    contas: 0,
    contasCobranca: "aparte",
    mesesOcupados: 0,
    prazoMedioMeses: 0,
    valorImovel: 0,
    investimentoMobilia: 0,
    reposicaoPct: 0,
    tradicional: { valorMensal: 0, mesesVazios: 0, taxaAdmPct: 0, intermediacaoACadaMeses: 0 },
    rendimentoPct: 0,
  };
}

export function calcularImovel(e: EntradaImovel, taxa: number): ResultadoImovel {
  const meses = Math.min(12, Math.round(num(e.mesesOcupados)));
  const pronto = num(e.valorMensal) > 0 && meses > 0;
  const rentabilidadeDe = (m: number) =>
    simularRentabilidade(
      {
        aluguelMensal: num(e.valorMensal),
        condoIptu: num(e.condoIptu),
        contas: num(e.contas),
        mesesOcupados: m,
        prazoMedioMeses: Math.max(1, num(e.prazoMedioMeses)),
        condoCobranca: e.condoCobranca,
        contasCobranca: e.contasCobranca,
        valorImovel: num(e.valorImovel),
        investimentoMobilia: num(e.investimentoMobilia),
        reposicaoAnualPct: pct(e.reposicaoPct),
      },
      taxa,
      0,
    );
  const comTradicional = num(e.tradicional.valorMensal) > 0;
  const comparacaoDe = (m: number): ResultadoROI | null =>
    comTradicional
      ? simularROI(
          {
            investimentoMobiliar: num(e.investimentoMobilia),
            aluguelVazio: num(e.tradicional.valorMensal),
            aluguelMobiliado: num(e.valorMensal),
            mesesOcupados: m,
            prazoMedioMeses: Math.max(1, num(e.prazoMedioMeses)),
            contasMensais: num(e.contas),
            reposicaoAnualPct: pct(e.reposicaoPct),
            condoIptu: num(e.condoIptu),
            condoCobranca: e.condoCobranca,
            contasCobranca: e.contasCobranca,
            // Sempre os números do dono — nunca os padrões de mercado da lib (campo vazio = 0).
            mesesVaziosTradicional: Math.min(12, Math.round(num(e.tradicional.mesesVazios))),
            taxaAdmTradicional: pct(e.tradicional.taxaAdmPct),
            intermediacaoACadaMeses: Math.round(num(e.tradicional.intermediacaoACadaMeses)),
            rendimentoAplicacaoPct: num(e.rendimentoPct) > 0 ? pct(e.rendimentoPct) : undefined,
          },
          taxa,
          0,
        )
      : null;
  const rentabilidade = rentabilidadeDe(meses);
  return {
    pronto,
    rentabilidade,
    contratosPorAno: num(e.prazoMedioMeses) > 0 && meses > 0 ? contratosPorAno(meses, num(e.prazoMedioMeses)) : null,
    comparacao: pronto ? comparacaoDe(meses) : null,
    cenarios: pronto
      ? cenariosDoDono(meses).map((c) => ({
          nome: c.nome,
          mesesOcupados: c.mesesOcupados,
          liquidaAnual: rentabilidadeDe(c.mesesOcupados).receitaLiquidaAnual,
          ganhoAdicionalAnual: comparacaoDe(c.mesesOcupados)?.ganhoAdicionalAnual ?? null,
        }))
      : [],
  };
}
