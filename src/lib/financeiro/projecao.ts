/*
  Modelo financeiro da empresa (PURO) — /simulacao e /roi usam ESTA conta, com
  as premissas de config/premissas-financeiras.ts. node --test, sem alias "@".

  Como calculamos (o mesmo texto aparece na página):
  • Modelo único: taxa de serviço por contrato fechado (renovação = novo contrato),
    sobre o valor TOTAL do contrato (ordem do Daniel, 14/10). Receita = contratos/mês × aluguel médio ×
    meses médios do contrato × taxa média ponderada pelas faixas. Sem cobrança recorrente nem churn de assinatura.
  • Contratos começam no mês 4 e crescem em linha reta até o teto do cenário.
  • Parceiros (seguros como representante, serviços) só entram quando ligados,
    a partir do mês de início de cada um: contratos × receita do parceiro.
  • Custo variável por contrato + imposto sobre a receita (6% ou 15,5%); custo fixo
    + marketing por mês; investimento único no mês 0.
  • Receitas adicionais (prompt 21, potencial, todas desligadas por padrão): verificação paga do inquilino (menos a
    CAF), empresas (B2B), "Publicamos para você" pago, ferramentas fora da Viva (recorrente, donos ativos com saída
    de 3%/mês) e a promoção fundadores (desconto na taxa). O imposto incide sobre a receita total.
  • ROI(N) = (caixa no mês N + investimento) ÷ investimento − 1, com investimento = dinheiro necessário (|pior caixa|).
*/
import { comissaoSobreContrato } from "../cobranca/regra.ts";
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
  MESES_MEDIOS_CONTRATO,
  RECEITAS_ADICIONAIS,
  VERIFICACAO,
  SAIDA_DONOS_MES,
  FUNDADORES_REGRA,
  type Parceiro,
  type ReceitaAdicional,
  type ReceitaAdicionalId,
  TAXA_MEDIA,
  REPRESENTANTE_SEGUROS,
  marketingDoMes,
  receitaParceiroPorContrato,
  type CenarioId,
} from "../../config/premissas-financeiras.ts";

export interface Opcoes {
  /** Operador local por contrato (R$ 0 ou R$ 100). */
  operador: number;
  /** Custo fixo mensal (padrão: soma dos fixos ≈ R$ 6 mil, com pró-labore). */
  custoFixo?: number;
  /** Imposto da Viva sobre a receita (padrão 6%; 15,5% no anexo V). */
  imposto?: number;
  /** Parceiros LIGADOS (ids de PARCEIROS). Padrão: nenhum — receita base pura. */
  parceiros?: readonly string[];
  /** % do prêmio que a Viva recebe como representante de seguros (0 a 15%; padrão 10%). */
  pctSeguro?: number;
  /** Duração média do contrato, em meses (premissa editável; padrão MESES_MEDIOS_CONTRATO). */
  mesesContrato?: number;
  /** Receitas adicionais LIGADAS (ids de RECEITAS_ADICIONAIS). Padrão: nenhuma. */
  extras?: readonly string[];
  /** Ajustes da tela por id (parceiro ou receita adicional): valor, adesão, mês de início. */
  ajustes?: Readonly<Record<string, Ajuste>>;
  /** Multiplica a adesão de parceiros e receitas adicionais (sensibilidade: 0,5 = metade; 2 = dobro). */
  fatorAdesao?: number;
}

export interface Ajuste {
  valor?: number;
  adesao?: number;
  mesInicio?: number;
}

export interface Mes {
  m: number;
  contratos: number;
  donos: number;
  /** Taxa de serviço por contrato fechado. */
  receitaTaxa: number;
  /** Receita base (= taxa de serviço). */
  receitaBase: number;
  /** Parceiros ligados (potencial) = seguros + serviços. */
  receitaParceiros: number;
  receitaSeguros: number;
  receitaServicos: number;
  receitaVerificacao: number;
  receitaB2B: number;
  receitaPublicamos: number;
  receitaFerramentas: number;
  /** Promoção fundadores: desconto na taxa (≤ 0). */
  descontoFundadores: number;
  /** Donos ativos (com saída de 3% ao mês) — base das ferramentas. */
  donosAtivos: number;
  /** Soma de todas as fontes (com o desconto). */
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
  receitaSeguros: number;
  receitaServicos: number;
  receitaVerificacao: number;
  receitaB2B: number;
  receitaPublicamos: number;
  receitaFerramentas: number;
  descontoFundadores: number;
  receita: number;
  resultado: number;
}

/** As fontes de receita, na ordem do gráfico (o desconto dos fundadores fica abaixo do zero). */
export const FONTES = [
  { campo: "receitaTaxa", nome: "Taxa de serviço" },
  { campo: "receitaSeguros", nome: "Seguros" },
  { campo: "receitaServicos", nome: "Serviços de parceiros" },
  { campo: "receitaVerificacao", nome: "Verificação do inquilino" },
  { campo: "receitaB2B", nome: "Empresas (B2B)" },
  { campo: "receitaPublicamos", nome: "Publicamos para você" },
  { campo: "receitaFerramentas", nome: "Ferramentas" },
  { campo: "descontoFundadores", nome: "Desconto fundadores" },
] as const;
export type CampoFonte = (typeof FONTES)[number]["campo"];

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

/** Taxa de serviço média por contrato (R$): aluguel médio × meses do contrato × taxa média ponderada pelas faixas. */
export function taxaMediaPorContrato(aluguel = ALUGUEL_MEDIO, meses = MESES_MEDIOS_CONTRATO): number {
  return comissaoSobreContrato(aluguel, meses, TAXA_MEDIA);
}

/** Receita bruta mensal da taxa de serviço para `contratos` contratos fechados no mês. */
export function receitaBrutaMensal(contratos: number, meses = MESES_MEDIOS_CONTRATO): number {
  return contratos * taxaMediaPorContrato(ALUGUEL_MEDIO, meses);
}

/** Duração aceita nas simulações: inteiro de 1 a 12 meses; fora disso (ou ilegível) vale o padrão. */
export function mesesContratoValidos(valor: unknown, padrao = MESES_MEDIOS_CONTRATO): number {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : typeof valor === "number" ? valor : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : padrao;
}

export interface ComparativoRegra {
  meses: number;
  /** Regra antiga (histórica): taxa só sobre o 1º mês de aluguel. */
  regraAntiga: number;
  /** Regra vigente: taxa sobre o valor total (aluguel × meses). */
  regraNova: number;
  diferenca: number;
}

/** Taxa por contrato nas duas regras, com o mesmo aluguel e a mesma taxa média — só para a página /decisao. */
export function comparativoRegraComissao(meses = MESES_MEDIOS_CONTRATO, aluguel = ALUGUEL_MEDIO, taxa = TAXA_MEDIA): ComparativoRegra {
  const m = mesesContratoValidos(meses);
  const regraAntiga = comissaoSobreContrato(aluguel, 1, taxa);
  const regraNova = comissaoSobreContrato(aluguel, m, taxa);
  return { meses: m, regraAntiga, regraNova, diferenca: Math.round((regraNova - regraAntiga) * 100) / 100 };
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

/** Parceiro com os ajustes da tela (valor, adesão, mês) e o fator de sensibilidade. */
function parceiroAjustado(p: Parceiro, op: Opcoes): Parceiro {
  const a = op.ajustes?.[p.id] ?? {};
  const fator = op.fatorAdesao ?? 1;
  return {
    ...p,
    valorUnidade: a.valor ?? p.valorUnidade,
    premioPorMes: a.valor !== undefined ? undefined : p.premioPorMes,
    adesao: Math.min(1, Math.max(0, (a.adesao ?? p.adesao) * fator)),
    mesInicio: a.mesInicio ?? p.mesInicio,
  };
}

/** Parceiros ligados nas opções (ids desconhecidos são ignorados), já ajustados. */
function parceirosLigados(op: Opcoes) {
  const ids = new Set(op.parceiros ?? []);
  return PARCEIROS.filter((p) => ids.has(p.id)).map((p) => parceiroAjustado(p, op));
}

/** Receita dos parceiros ligados por contrato no mês m (antes do imposto). Grupo opcional: seguros ou serviços. */
export function parceirosPorContrato(op: Opcoes, m = Infinity, tipo?: Parceiro["tipo"]): number {
  const meses = mesesContratoValidos(op.mesesContrato);
  return parceirosLigados(op)
    .filter((p) => m >= p.mesInicio && (!tipo || p.tipo === tipo))
    .reduce((s, p) => s + receitaParceiroPorContrato(p, op.pctSeguro ?? REPRESENTANTE_SEGUROS.padrao, meses), 0);
}

/** Receita adicional com os ajustes da tela e o fator de sensibilidade (o fator não mexe nos fundadores). */
export function extraAjustada(e: ReceitaAdicional, op: Opcoes): ReceitaAdicional {
  const a = op.ajustes?.[e.id] ?? {};
  const fator = e.natureza === "receita" ? (op.fatorAdesao ?? 1) : 1;
  return { ...e, valor: a.valor ?? e.valor, adesao: Math.min(1, Math.max(0, (a.adesao ?? e.adesao) * fator)), mesInicio: a.mesInicio ?? e.mesInicio };
}

function extraLigada(op: Opcoes, id: ReceitaAdicionalId): ReceitaAdicional | null {
  if (!(op.extras ?? []).includes(id)) return null;
  const e = RECEITAS_ADICIONAIS.find((x) => x.id === id);
  return e ? extraAjustada(e, op) : null;
}

export function projetar(id: CenarioId, op: Opcoes): Projecao {
  const cen = CENARIOS[id];
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const mesesContrato = mesesContratoValidos(op.mesesContrato);
  const taxaContrato = taxaMediaPorContrato(ALUGUEL_MEDIO, mesesContrato);
  const verif = extraLigada(op, "verificacao_inquilino");
  const b2b = extraLigada(op, "b2b_alocacao");
  const publicamos = extraLigada(op, "publicamos_pago");
  const ferramentas = extraLigada(op, "ferramentas_fora");
  const fundadores = extraLigada(op, "fundadores");
  let donos = 0;
  let donosAtivos = 0;
  /** Fundadores por mês de entrada (os N primeiros donos a partir do início da promoção). */
  const fundadoresPorMes = new Map<number, number>();
  let fundadoresTotal = 0;
  let caixa = -INVESTIMENTO_INICIAL;
  let piorCaixa = caixa;
  let mesPiorCaixa = 0;
  let mesPrimeiroPositivo: number | null = null;
  let mesPayback: number | null = null;
  const meses: Mes[] = [];

  for (let m = 1; m <= HORIZONTE_MESES; m++) {
    donos += cen.donosNovosMes;
    donosAtivos = donosAtivos * (1 - SAIDA_DONOS_MES) + cen.donosNovosMes;
    const contratos = contratosNoMes(id, m);
    const receitaTaxa = contratos * taxaContrato;
    const receitaBase = receitaTaxa;
    const receitaSeguros = contratos * parceirosPorContrato(op, m, "seguro");
    const receitaServicos = contratos * parceirosPorContrato(op, m, "servico");
    const receitaParceiros = receitaSeguros + receitaServicos;

    const verificacoes = verif && m >= verif.mesInicio ? contratos * VERIFICACAO.candidatosPorContrato * verif.adesao : 0;
    const receitaVerificacao = verif ? verificacoes * verif.valor : 0;
    const receitaB2B = b2b && m >= b2b.mesInicio ? contratos * b2b.adesao * b2b.valor : 0;
    const receitaPublicamos = publicamos && m >= publicamos.mesInicio ? cen.donosNovosMes * publicamos.adesao * publicamos.valor : 0;
    const receitaFerramentas = ferramentas && m >= ferramentas.mesInicio ? donosAtivos * ferramentas.adesao * ferramentas.valor : 0;

    // Fundadores: os primeiros donos (a partir do início) pagam a taxa reduzida nos seus primeiros meses.
    let descontoFundadores = 0;
    if (fundadores && m >= fundadores.mesInicio) {
      const entram = Math.min(cen.donosNovosMes, Math.max(0, FUNDADORES_REGRA.donos - fundadoresTotal));
      if (entram > 0) {
        fundadoresPorMes.set(m, entram);
        fundadoresTotal += entram;
      }
      let naJanela = 0;
      for (const [entrada, n] of fundadoresPorMes) if (m - entrada < FUNDADORES_REGRA.meses) naJanela += n;
      const parte = donos > 0 ? Math.min(1, naJanela / donos) : 0;
      const diferenca = Math.max(0, TAXA_MEDIA - fundadores.valor);
      descontoFundadores = 0 - contratos * parte * ALUGUEL_MEDIO * mesesContrato * diferenca; // "0 -" evita -0 quando não há desconto
    }

    const receita = receitaTaxa + receitaParceiros + receitaVerificacao + receitaB2B + receitaPublicamos + receitaFerramentas + descontoFundadores;
    const custoVariavel =
      contratos * (CUSTO_FERRAMENTAS_POR_CONTRATO + op.operador) + verificacoes * VERIFICACAO.custoCaf + (op.imposto ?? IMPOSTO_SOBRE_RECEITA) * receita;
    const marketing = marketingDoMes(m);
    const resultado = receita - custoVariavel - fixo - marketing;
    caixa += resultado;
    if (caixa < piorCaixa) {
      piorCaixa = caixa;
      mesPiorCaixa = m;
    }
    if (mesPrimeiroPositivo === null && resultado > 0) mesPrimeiroPositivo = m;
    if (mesPayback === null && caixa >= 0) mesPayback = m;
    meses.push({
      m,
      contratos,
      donos,
      donosAtivos,
      receitaTaxa,
      receitaBase,
      receitaParceiros,
      receitaSeguros,
      receitaServicos,
      receitaVerificacao,
      receitaB2B,
      receitaPublicamos,
      receitaFerramentas,
      descontoFundadores,
      receita,
      custoVariavel,
      custoFixo: fixo,
      marketing,
      resultado,
      caixa,
    });
  }

  const soma = (fatia: Mes[], k: keyof Mes) => fatia.reduce((s, x) => s + (x[k] as number), 0);
  const anos: Ano[] = [0, 1, 2].map((a) => {
    const fatia = meses.slice(a * 12, a * 12 + 12);
    return {
      ano: a + 1,
      contratos: soma(fatia, "contratos"),
      receitaBase: soma(fatia, "receitaBase"),
      receitaParceiros: soma(fatia, "receitaParceiros"),
      receitaSeguros: soma(fatia, "receitaSeguros"),
      receitaServicos: soma(fatia, "receitaServicos"),
      receitaVerificacao: soma(fatia, "receitaVerificacao"),
      receitaB2B: soma(fatia, "receitaB2B"),
      receitaPublicamos: soma(fatia, "receitaPublicamos"),
      receitaFerramentas: soma(fatia, "receitaFerramentas"),
      descontoFundadores: soma(fatia, "descontoFundadores"),
      receita: soma(fatia, "receita"),
      resultado: soma(fatia, "resultado"),
    };
  });
  return { meses, anos, piorCaixa, mesPiorCaixa, mesPrimeiroPositivo, mesPayback, caixaFinal: caixa };
}

/**
 * ROI no mês N = (caixa acumulado no mês N + investimento) ÷ investimento − 1, com investimento = dinheiro
 * necessário (|pior caixa|, que já inclui o investimento inicial). Sem necessidade de caixa: null.
 */
export function roi(proj: Projecao, meses: number): number | null {
  const investimento = Math.abs(Math.min(0, proj.piorCaixa));
  const linha = proj.meses[Math.min(proj.meses.length, Math.max(1, meses)) - 1];
  if (!investimento || !linha) return null;
  return (linha.caixa + investimento) / investimento - 1;
}

export type ReceitaPorContrato = Record<Exclude<CampoFonte, never>, number> & { total: number };

/**
 * "De onde vem cada contrato": R$ por contrato fechado de cada fonte, na média do ano 3 do cenário (todas as fontes
 * já começaram). Fontes que não dependem de contrato (Publicamos, ferramentas) entram divididas pelos contratos.
 */
export function receitaPorContrato(op: Opcoes, id: CenarioId = "base"): ReceitaPorContrato {
  const ano = projetar(id, op).anos[2];
  const n = ano.contratos || 1;
  const r = {
    receitaTaxa: ano.receitaBase / n,
    receitaSeguros: ano.receitaSeguros / n,
    receitaServicos: ano.receitaServicos / n,
    receitaVerificacao: ano.receitaVerificacao / n,
    receitaB2B: ano.receitaB2B / n,
    receitaPublicamos: ano.receitaPublicamos / n,
    receitaFerramentas: ano.receitaFerramentas / n,
    descontoFundadores: ano.descontoFundadores / n,
  };
  return { ...r, total: Object.values(r).reduce((s, v) => s + v, 0) };
}

/** Sensibilidade: payback e pior caixa com a adesão de parceiros e receitas adicionais multiplicada. */
export const FATORES_ADESAO = [0.5, 1, 2] as const;
export function sensibilidadeAdesao(id: CenarioId, op: Opcoes, fatores: readonly number[] = FATORES_ADESAO) {
  return fatores.map((fator) => {
    const p = projetar(id, { ...op, fatorAdesao: fator });
    return { fator, mesPayback: p.mesPayback, piorCaixa: p.piorCaixa };
  });
}

const milTexto = (n: number) =>
  `${n < 0 ? "−" : ""}R$ ${(Math.abs(n) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
const pctRoi = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100).toLocaleString("pt-BR")}%`);
const sePaga = (m: number | null) => (m === null ? "não se paga em 36 meses" : `se paga no mês ${m}`);

/**
 * Frase do topo, gerada da conta: dinheiro necessário, payback e ROI de 36 meses — só taxa e, se houver receitas
 * ligadas, com elas.
 */
export function fraseResumo(nomeCenario: string, soTaxa: Projecao, comExtras: Projecao, ligadas: number): string {
  const r0 = pctRoi(roi(soTaxa, 36));
  if (!ligadas) {
    return `Cenário ${nomeCenario}, só com a taxa de serviço: a Viva precisa de até ${milTexto(Math.abs(soTaxa.piorCaixa))}, ${
      soTaxa.mesPrimeiroPositivo === null ? "não tem mês positivo em 36 meses" : `tem o 1º mês positivo no mês ${soTaxa.mesPrimeiroPositivo}`
    } e ${sePaga(soTaxa.mesPayback)}. Em 36 meses, o retorno é de ${r0} sobre esse dinheiro.`;
  }
  const n = ligadas === 1 ? "1 receita adicional ligada" : `${ligadas} receitas adicionais ligadas`;
  return `Cenário ${nomeCenario}: só com a taxa de serviço, a Viva precisa de até ${milTexto(Math.abs(soTaxa.piorCaixa))} e ${sePaga(
    soTaxa.mesPayback
  )}; com ${n} (potencial), precisa de até ${milTexto(Math.abs(comExtras.piorCaixa))} e ${sePaga(comExtras.mesPayback)}. Em 36 meses, o retorno vai de ${r0} para ${pctRoi(
    roi(comExtras, 36)
  )}.`;
}

export interface PorContrato {
  /** Taxa média ponderada + parceiros ligados (todos já iniciados). */
  receita: number;
  /** Ferramentas + imposto sobre a receita + operador. */
  custoVariavel: number;
  margem: number;
  /** Contratos/mês para pagar fixo + marketing (sem assinaturas: não há cobrança recorrente): [ano 1, depois]. */
  empate: [number, number];
}

/** Conta de UM contrato típico (dono comum; parceiros só se ligados). */
export function porContrato(op: Opcoes): PorContrato {
  const fixo = op.custoFixo ?? CUSTO_FIXO_PADRAO;
  const receita = taxaMediaPorContrato(ALUGUEL_MEDIO, mesesContratoValidos(op.mesesContrato)) + parceirosPorContrato(op);
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
