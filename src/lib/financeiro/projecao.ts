/*
  Modelo financeiro da empresa (PURO) — /simulacao e /roi usam ESTA conta, com
  as premissas de config/premissas-financeiras.ts. node --test, sem alias "@".

  Como calculamos (o mesmo texto aparece na página):
  • Modelo único: taxa de serviço por contrato fechado (renovação = novo contrato),
    sobre o valor do 1º mês. Receita = contratos/mês × valor médio do 1º mês ×
    taxa média ponderada pelas faixas. Sem mensalidade nem churn de assinatura.
  • Contratos começam no mês 4 e crescem em linha reta até o teto do cenário.
  • Parceiros (seguros como representante, serviços) só entram quando ligados,
    a partir do mês de início de cada um: contratos × receita do parceiro.
  • Custo variável por contrato + imposto sobre a receita (6% ou 15,5%); custo fixo
    + marketing por mês; investimento único no mês 0.
*/
import {
  ALUGUEL_MEDIO,
  CENARIOS,
  CONTRATOS_MES_CENARIOS,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  HORIZONTE_MESES,
  IMPOSTO_SOBRE_RECEITA,
  INVESTIMENTO_INICIAL,
  MES_PRIMEIRO_CONTRATO,
  OPERADOR_OPCOES,
  PARCEIROS,
  TAXA_MEDIA,
  REPRESENTANTE_SEGUROS,
  marketingDoMes,
  receitaParceiroPorContrato,
  type CenarioId,
} from "../../config/premissas-financeiras.ts";

export interface Opcoes {
  /** Operador local por contrato (R$ 0 ou R$ 100). */
  operador: number;
  /** Custo fixo mensal (padrão: soma dos fixos = R$ 989). */
  custoFixo?: number;
  /** Imposto da Viva sobre a receita (padrão 6%; 15,5% no anexo V). */
  imposto?: number;
  /** Parceiros LIGADOS (ids de PARCEIROS). Padrão: nenhum — receita base pura. */
  parceiros?: readonly string[];
  /** % do prêmio que a Viva recebe como representante de seguros (0 a 15%; padrão 10%). */
  pctSeguro?: number;
}

export interface Mes {
  m: number;
  contratos: number;
  donos: number;
  /** Taxa de serviço por contrato fechado. */
  receitaTaxa: number;
  /** Receita base (= taxa de serviço). */
  receitaBase: number;
  /** Parceiros ligados (potencial). */
  receitaParceiros: number;
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
  receitaBase: number;
  receitaParceiros: number;
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

/** Taxa de serviço média por contrato (R$): valor médio do 1º mês × taxa média ponderada pelas faixas. */
export function taxaMediaPorContrato(aluguel = ALUGUEL_MEDIO): number {
  return Math.round(aluguel * TAXA_MEDIA * 100) / 100;
}

/** Receita bruta mensal da taxa de serviço para `contratos` contratos fechados no mês. */
export function receitaBrutaMensal(contratos: number): number {
  return contratos * taxaMediaPorContrato();
}

export interface CenarioContratos {
  contratos: number;
  receita: number;
  /** Resultado do mês com o custo fixo e o custo variável por contrato (sem marketing). */
  resultado: number;
}

/** Cenários 10/20/40 contratos por mês: receita bruta e resultado do mês (depois de ferramentas, imposto e custo fixo). */
export function cenariosContratosMes(op: Opcoes): CenarioContratos[] {
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const u = porContrato(op);
  return CONTRATOS_MES_CENARIOS.map((n) => ({ contratos: n, receita: n * u.receita, resultado: n * u.margem - fixo }));
}

/** Contratos fechados no mês m de um cenário. */
export function contratosNoMes(id: CenarioId, m: number): number {
  const c = CENARIOS[id];
  if (m < MES_PRIMEIRO_CONTRATO) return 0;
  return Math.min(c.teto, c.contratosIniciais + c.crescimentoMensal * (m - MES_PRIMEIRO_CONTRATO));
}

/** Parceiros ligados nas opções (ids desconhecidos são ignorados). */
function parceirosLigados(op: Opcoes) {
  const ids = new Set(op.parceiros ?? []);
  return PARCEIROS.filter((p) => ids.has(p.id));
}

/** Receita dos parceiros ligados por contrato no mês m (antes do imposto). */
export function parceirosPorContrato(op: Opcoes, m = Infinity): number {
  return parceirosLigados(op)
    .filter((p) => m >= p.mesInicio)
    .reduce((s, p) => s + receitaParceiroPorContrato(p, op.pctSeguro ?? REPRESENTANTE_SEGUROS.padrao), 0);
}

export function projetar(id: CenarioId, op: Opcoes): Projecao {
  const cen = CENARIOS[id];
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const taxaContrato = taxaMediaPorContrato();
  let donos = 0;
  let caixa = -INVESTIMENTO_INICIAL;
  let piorCaixa = caixa;
  let mesPiorCaixa = 0;
  let mesPrimeiroPositivo: number | null = null;
  let mesPayback: number | null = null;
  const meses: Mes[] = [];

  for (let m = 1; m <= HORIZONTE_MESES; m++) {
    donos += cen.donosNovosMes;
    const contratos = contratosNoMes(id, m);
    const receitaTaxa = contratos * taxaContrato;
    const receitaBase = receitaTaxa;
    const receitaParceiros = contratos * parceirosPorContrato(op, m);
    const receita = receitaBase + receitaParceiros;
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
    meses.push({ m, contratos, donos, receitaTaxa, receitaBase, receitaParceiros, receita, custoVariavel, custoFixo: fixo, marketing, resultado, caixa });
  }

  const anos: Ano[] = [0, 1, 2].map((a) => {
    const fatia = meses.slice(a * 12, a * 12 + 12);
    return {
      ano: a + 1,
      contratos: fatia.reduce((s, x) => s + x.contratos, 0),
      receitaBase: fatia.reduce((s, x) => s + x.receitaBase, 0),
      receitaParceiros: fatia.reduce((s, x) => s + x.receitaParceiros, 0),
      receita: fatia.reduce((s, x) => s + x.receita, 0),
      resultado: fatia.reduce((s, x) => s + x.resultado, 0),
    };
  });
  return { meses, anos, piorCaixa, mesPiorCaixa, mesPrimeiroPositivo, mesPayback, caixaFinal: caixa };
}

export interface PorContrato {
  /** Taxa média ponderada + parceiros ligados (todos já iniciados). */
  receita: number;
  /** Ferramentas + imposto sobre a receita + operador. */
  custoVariavel: number;
  margem: number;
  /** Contratos/mês para pagar fixo + marketing (sem assinaturas: não há mensalidade): [ano 1, depois]. */
  empate: [number, number];
}

/** Conta de UM contrato típico (dono comum; parceiros só se ligados). */
export function porContrato(op: Opcoes): PorContrato {
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const receita = taxaMediaPorContrato() + parceirosPorContrato(op);
  const custoVariavel = CUSTO_FERRAMENTAS_POR_CONTRATO + (op.imposto ?? IMPOSTO_SOBRE_RECEITA) * receita + op.operador;
  const margem = receita - custoVariavel;
  const empate = (mkt: number) => (margem > 0 ? (fixo + mkt) / margem : Infinity);
  return { receita, custoVariavel, margem, empate: [empate(marketingDoMes(12)), empate(marketingDoMes(13))] };
}

export interface LinhaInvestidor {
  operador: number;
  anos: Ano[];
  piorCaixa: number;
  mesPayback: number | null;
}

/**
 * Visão do investidor: 3 anos do cenário, com e sem operador, separando a
 * receita base da receita de parceiros escolhidos (potencial).
 */
export function visaoInvestidor(id: CenarioId, op: Omit<Opcoes, "operador">, operadores: readonly number[] = OPERADOR_OPCOES): LinhaInvestidor[] {
  return operadores.map((operador) => {
    const p = projetar(id, { ...op, operador });
    return { operador, anos: p.anos, piorCaixa: p.piorCaixa, mesPayback: p.mesPayback };
  });
}
