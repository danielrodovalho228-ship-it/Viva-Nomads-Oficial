/*
  Modelo financeiro da empresa (PURO) — /simulacao e /roi usam ESTA conta, com
  as premissas de config/premissas-financeiras.ts. node --test, sem alias "@".

  Como calculamos (o mesmo texto aparece na página):
  • Contratos começam no mês 4 e crescem em linha reta até o teto do cenário.
  • Donos novos entram todo mês desde o mês 1. Os 20 primeiros são Fundadores:
    12 meses no Profissional sem assinatura (comissão do Profissional). A parte
    dos contratos que vem deles = Fundadores no período de 12 meses ÷ todos os
    donos. Depois dos 12 meses, assinam na mesma proporção dos outros.
  • Dos donos novos (não Fundadores), a fração do cenário assina um plano pago
    (média R$ 55/mês), com churn de 3% ao mês.
  • Seguro incêndio a partir do mês 9 (parceiro ativo).
  • Custo variável por contrato + imposto sobre a receita (6% ou 15,5%); custo fixo
    + marketing por mês; investimento único no mês 0.
*/
import {
  ALUGUEL_MEDIO,
  ASSINATURA,
  CENARIOS,
  COMISSAO,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  FUNDADORES,
  HORIZONTE_MESES,
  IMPOSTO_SOBRE_RECEITA,
  INVESTIMENTO_INICIAL,
  MES_PRIMEIRO_CONTRATO,
  MIX_PLANOS,
  SEGURO_INCENDIO,
  marketingDoMes,
  type CenarioId,
} from "../../config/premissas-financeiras.ts";

export interface Opcoes {
  /** Operador local por contrato (R$ 0 ou R$ 100). */
  operador: number;
  /** Custo fixo mensal (padrão: soma dos fixos = R$ 989). */
  custoFixo?: number;
  /** Imposto da Viva sobre a receita (padrão 6%; 15,5% no anexo V). */
  imposto?: number;
}

export interface Mes {
  m: number;
  contratos: number;
  donos: number;
  assinantes: number;
  receitaComissao: number;
  receitaAssinatura: number;
  receitaSeguro: number;
  receita: number;
  custoVariavel: number;
  custoFixo: number;
  marketing: number;
  resultado: number;
  caixa: number;
}

export interface Ano {
  ano: number;
  contratos: number;
  receita: number;
  resultado: number;
}

export interface Projecao {
  meses: Mes[];
  anos: Ano[];
  /** Pior caixa acumulado (inclui o investimento) = dinheiro necessário. */
  piorCaixa: number;
  mesPiorCaixa: number;
  /** Primeiro mês com resultado mensal positivo (null = não chega em 36 meses). */
  mesPrimeiroPositivo: number | null;
  /** Primeiro mês com caixa acumulado ≥ 0 (null = não se paga em 36 meses). */
  mesPayback: number | null;
  caixaFinal: number;
}

export const CUSTO_FIXO_PADRAO = CUSTOS_FIXOS.reduce((s, c) => s + c.valor, 0);
export const CUSTO_FERRAMENTAS_POR_CONTRATO = CUSTOS_POR_CONTRATO.reduce((s, c) => s + c.valor, 0);

/** Comissão média por contrato (R$) pelo mix de planos dos donos comuns. */
export function comissaoMediaPorContrato(aluguel = ALUGUEL_MEDIO): number {
  let soma = 0;
  let peso = 0;
  for (const [id, w] of Object.entries(MIX_PLANOS) as [keyof typeof COMISSAO, number][]) {
    soma += w * COMISSAO[id] * aluguel;
    peso += w;
  }
  return peso > 0 ? soma / peso : 0;
}

/** Contratos fechados no mês m de um cenário. */
export function contratosNoMes(id: CenarioId, m: number): number {
  const c = CENARIOS[id];
  if (m < MES_PRIMEIRO_CONTRATO) return 0;
  return Math.min(c.teto, c.contratosIniciais + c.crescimentoMensal * (m - MES_PRIMEIRO_CONTRATO));
}

export function projetar(id: CenarioId, op: Opcoes): Projecao {
  const cen = CENARIOS[id];
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const comMix = comissaoMediaPorContrato();
  const comFundador = FUNDADORES.comissao * ALUGUEL_MEDIO;

  // Entrada dos Fundadores por mês (para saber quando cada leva sai dos 12 meses).
  const entradaFundadores: number[] = [];
  let donos = 0;
  let fundadoresTotais = 0;
  let assinantes = 0;
  let caixa = -INVESTIMENTO_INICIAL;
  let piorCaixa = caixa;
  let mesPiorCaixa = 0;
  let mesPrimeiroPositivo: number | null = null;
  let mesPayback: number | null = null;
  const meses: Mes[] = [];

  for (let m = 1; m <= HORIZONTE_MESES; m++) {
    const novos = cen.donosNovosMes;
    const fundadoresNovos = Math.min(novos, Math.max(0, FUNDADORES.quantidade - fundadoresTotais));
    fundadoresTotais += fundadoresNovos;
    entradaFundadores[m] = fundadoresNovos;
    donos += novos;

    // Fundadores ainda nos 12 meses e os que saem neste mês (passam a poder assinar).
    let fundadoresAtivos = 0;
    for (let e = Math.max(1, m - FUNDADORES.meses + 1); e <= m; e++) fundadoresAtivos += entradaFundadores[e] ?? 0;
    const fundadoresSaindo = m - FUNDADORES.meses >= 1 ? entradaFundadores[m - FUNDADORES.meses] ?? 0 : 0;
    assinantes = assinantes * (1 - ASSINATURA.churnMensal) + (novos - fundadoresNovos + fundadoresSaindo) * cen.assinam;

    const contratos = contratosNoMes(id, m);
    const fatiaFundadores = donos > 0 ? fundadoresAtivos / donos : 0;
    const receitaComissao = contratos * (fatiaFundadores * comFundador + (1 - fatiaFundadores) * comMix);
    const receitaAssinatura = assinantes * ASSINATURA.mediaPagantes;
    const receitaSeguro = SEGURO_INCENDIO.parceiroAtivo && m >= SEGURO_INCENDIO.aPartirDoMes ? contratos * SEGURO_INCENDIO.porContrato : 0;
    const receita = receitaComissao + receitaAssinatura + receitaSeguro;
    const custoVariavel = contratos * (CUSTO_FERRAMENTAS_POR_CONTRATO + op.operador) + (op.imposto ?? IMPOSTO_SOBRE_RECEITA) * receita;
    const marketing = marketingDoMes(m);
    const resultado = receita - custoVariavel - fixo - marketing;
    caixa += resultado;
    if (caixa < piorCaixa) {
      piorCaixa = caixa;
      mesPiorCaixa = m;
    }
    if (mesPrimeiroPositivo === null && resultado > 0) mesPrimeiroPositivo = m;
    if (mesPayback === null && caixa >= 0) mesPayback = m;
    meses.push({ m, contratos, donos, assinantes, receitaComissao, receitaAssinatura, receitaSeguro, receita, custoVariavel, custoFixo: fixo, marketing, resultado, caixa });
  }

  const anos: Ano[] = [0, 1, 2].map((a) => {
    const fatia = meses.slice(a * 12, a * 12 + 12);
    return {
      ano: a + 1,
      contratos: fatia.reduce((s, x) => s + x.contratos, 0),
      receita: fatia.reduce((s, x) => s + x.receita, 0),
      resultado: fatia.reduce((s, x) => s + x.resultado, 0),
    };
  });
  return { meses, anos, piorCaixa, mesPiorCaixa, mesPrimeiroPositivo, mesPayback, caixaFinal: caixa };
}

export interface PorContrato {
  /** Comissão média (mix) + seguro incêndio. */
  receita: number;
  /** Ferramentas + imposto sobre a receita + operador. */
  custoVariavel: number;
  margem: number;
  /** Contratos/mês para pagar fixo + marketing (sem contar assinaturas): [ano 1, depois]. */
  empate: [number, number];
}

/** Conta de UM contrato típico (dono comum, seguro ativo). */
export function porContrato(op: Opcoes): PorContrato {
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const receita = comissaoMediaPorContrato() + (SEGURO_INCENDIO.parceiroAtivo ? SEGURO_INCENDIO.porContrato : 0);
  const custoVariavel = CUSTO_FERRAMENTAS_POR_CONTRATO + (op.imposto ?? IMPOSTO_SOBRE_RECEITA) * receita + op.operador;
  const margem = receita - custoVariavel;
  const empate = (mkt: number) => (margem > 0 ? (fixo + mkt) / margem : Infinity);
  return { receita, custoVariavel, margem, empate: [empate(marketingDoMes(12)), empate(marketingDoMes(13))] };
}
