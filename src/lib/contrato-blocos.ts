/*
  Contrato fracionado em BLOCOS — regras PURAS (sem efeito colateral).

  A sacada: uma locação longa é contratada em blocos menores (padrão 2 meses),
  para caber no cartão e manter a caução INTEGRAL por bloco.

  Definições inegociáveis (v2 do prompt — base do produto):
  • CONTRATO-MÃE = o prazo total pretendido que o inquilino declara no
    fechamento (ex.: 6 meses). A COMISSÃO incide UMA ÚNICA VEZ por contrato-mãe,
    no fechamento, sobre 1 (um) mês de aluguel. Renovar ou estender blocos NÃO
    gera nova comissão — a comissão é por relação fechada, não por prazo.
  • Nenhum BLOCO pode exceder 90 dias (art. 48, Lei 8.245/91).
  • Caução do bloco = 50% do valor do bloco (aluguel × meses do bloco).

  Regra de ouro: a plataforma só CALCULA, exibe e documenta — o dinheiro
  (aluguel e caução) vai para o proprietário / poupança da caução / emissor,
  NUNCA para a plataforma.
*/

import { REGRAS_CONTRATO } from "../config/planos.ts";

/** Fração da caução por bloco (50%) — de REGRAS_CONTRATO (fonte única). */
export const PERC_CAUCAO_BLOCO = REGRAS_CONTRATO.caucaoFracaoBloco;

/** Tamanho padrão do bloco, em meses (configurável no fechamento). */
export const MESES_POR_BLOCO_PADRAO = REGRAS_CONTRATO.mesesPorBlocoPadrao;
/** Teto legal de dias por bloco (temporada — art. 48). */
export const MAX_DIAS_BLOCO = REGRAS_CONTRATO.maxDiasBloco;
/** Dias por mês usados no encadeamento das datas (aproximação comercial). */
export const DIAS_POR_MES = REGRAS_CONTRATO.diasPorMes;
/** Máximo de meses por bloco para não estourar 90 dias (90 / 30 = 3). */
export const MAX_MESES_BLOCO = Math.floor(MAX_DIAS_BLOCO / DIAS_POR_MES);
/** Prazo total do contrato: 1 a 6 meses, no máximo 180 dias. */
export const PRAZO_MIN_MESES = REGRAS_CONTRATO.prazoMinMeses;
export const PRAZO_MAX_MESES = REGRAS_CONTRATO.prazoMaxMeses;
export const PRAZO_MAX_DIAS = REGRAS_CONTRATO.prazoMaxDias;
/** Caução total do contrato ≤ 3 aluguéis (art. 38 §2º). */
export const CAUCAO_MAX_ALUGUEIS = REGRAS_CONTRATO.caucaoMaxAlugueis;

/**
 * Caução do PRÓXIMO bloco: 50% do valor do bloco, limitada ao que falta para
 * a soma das cauções do contrato chegar a 3 aluguéis.
 */
export function caucaoDoBloco(valorBloco: number, aluguelMensal: number, caucaoJaExigida: number): number {
  const teto = Math.max(0, aluguelMensal * CAUCAO_MAX_ALUGUEIS - Math.max(0, caucaoJaExigida));
  return Math.min(Math.round(Math.max(0, valorBloco) * PERC_CAUCAO_BLOCO), Math.round(teto));
}

/**
 * O contrato pode ganhar um bloco de `mesesNovo` meses? Só se o total (dias já
 * contratados + novo bloco) não passar de 180 dias.
 */
export function cabeNoPrazoMaximo(diasJaContratados: number, mesesNovo: number): boolean {
  return Math.max(0, diasJaContratados) + Math.max(0, mesesNovo) * DIAS_POR_MES <= PRAZO_MAX_DIAS;
}

export interface BlocoPlano {
  numero: number;
  meses: number;
  valor: number; // aluguel × meses do bloco
  caucao: number; // 50% do valor do bloco
  desembolso: number; // valor + caução — o que sai no início do bloco
}

/**
 * Divide o prazo total (em meses) em blocos de `tamanhoBlocoMeses` (padrão 2),
 * sendo o último bloco o resto. Cada bloco respeita o teto de 90 dias. Retorna
 * a lista com valor e caução (50%) por bloco.
 */
export function planejarBlocos(
  prazoTotalMeses: number,
  aluguelMensal: number,
  tamanhoBlocoMeses: number = MESES_POR_BLOCO_PADRAO
): BlocoPlano[] {
  const total = Math.max(1, Math.floor(prazoTotalMeses));
  const aluguel = Math.max(0, aluguelMensal);
  // Bloco nunca excede 90 dias (≤ 3 meses) nem 1 mês; e nunca é maior que o total.
  const passo = Math.min(Math.max(1, Math.floor(tamanhoBlocoMeses)), MAX_MESES_BLOCO, total);

  const blocos: BlocoPlano[] = [];
  let restante = total;
  let numero = 1;
  let caucaoAcumulada = 0;
  while (restante > 0) {
    const meses = Math.min(passo, restante);
    const valor = aluguel * meses;
    const caucao = caucaoDoBloco(valor, aluguel, caucaoAcumulada);
    caucaoAcumulada += caucao;
    blocos.push({ numero, meses, valor, caucao, desembolso: valor + caucao });
    restante -= meses;
    numero += 1;
  }
  return blocos;
}

/**
 * Comissão do contrato-mãe: 1 (um) mês de aluguel × taxa do plano, UMA vez.
 * Gestor = 0% (rate 0). Cobrada só no fechamento; renovação/extensão não
 * recobra. A taxa (0..1) vem do plano do proprietário — o caller resolve o
 * plano→taxa (via COMMISSION_BY_PLAN); este módulo puro só aplica o cálculo.
 */
export function comissaoContrato(aluguelMensal: number, rate: number): number {
  return Math.round(Math.max(0, aluguelMensal) * Math.max(0, rate));
}

export interface ResumoContrato {
  blocos: BlocoPlano[];
  prazoTotalMeses: number;
  tamanhoBlocoMeses: number;
  aluguelMensal: number;
  valorTotalPeriodo: number; // aluguel × prazo total
  caucaoTotal: number; // soma das cauções dos blocos
  comissaoPercent: number; // taxa do plano (0..1)
  comissaoValor: number; // 1 mês × taxa, UMA vez
  desembolsoPrimeiroBloco: number; // o que o inquilino paga para entrar
}

/**
 * Resumo completo do contrato fracionado para exibição no fechamento:
 * blocos, total do período, caução total, comissão única e o desembolso do 1º
 * bloco (o que o inquilino efetivamente paga para começar).
 */
export function resumoContrato(
  prazoTotalMeses: number,
  aluguelMensal: number,
  comissaoRate: number,
  tamanhoBlocoMeses: number = MESES_POR_BLOCO_PADRAO
): ResumoContrato {
  const blocos = planejarBlocos(prazoTotalMeses, aluguelMensal, tamanhoBlocoMeses);
  const total = Math.max(1, Math.floor(prazoTotalMeses));
  const aluguel = Math.max(0, aluguelMensal);
  const rate = Math.max(0, comissaoRate);
  return {
    blocos,
    prazoTotalMeses: total,
    tamanhoBlocoMeses: blocos[0]?.meses ?? Math.min(tamanhoBlocoMeses, total),
    aluguelMensal: aluguel,
    valorTotalPeriodo: aluguel * total,
    caucaoTotal: blocos.reduce((s, b) => s + b.caucao, 0),
    comissaoPercent: rate,
    comissaoValor: comissaoContrato(aluguel, rate),
    desembolsoPrimeiroBloco: blocos[0]?.desembolso ?? 0,
  };
}

/** Data (ISO yyyy-mm-dd) somando `dias` a uma data ISO. Puro, sem `now`. */
export function addDiasISO(inicioISO: string, dias: number): string {
  const base = new Date(`${inicioISO}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + Math.round(dias));
  return base.toISOString().slice(0, 10);
}

export interface BlocoComDatas extends BlocoPlano {
  inicio: string; // ISO yyyy-mm-dd
  fim: string; // ISO yyyy-mm-dd
}

/**
 * Último dia (INCLUSIVO) de um período de `dias` que começa em `inicioISO`:
 * `fim = início + dias − 1`. Ex.: 30 dias a partir de 01/01 → 30/01 (antes
 * 31/01, um dia a mais por bloco — 31/01 a 01/05 davam 91 dias).
 */
export function fimInclusivoISO(inicioISO: string, dias: number): string {
  return addDiasISO(inicioISO, Math.max(1, Math.round(dias)) - 1);
}

/** Dias corridos de um período com início e fim INCLUSIVOS. */
export function diasInclusivos(inicioISO: string, fimISO: string): number {
  return Math.round((Date.parse(`${fimISO}T00:00:00Z`) - Date.parse(`${inicioISO}T00:00:00Z`)) / 86400000) + 1;
}

/**
 * Encadeia as datas dos blocos a partir de um início (ISO). Cada bloco dura
 * `meses×30` dias com fim INCLUSIVO, e o seguinte começa no dia SEGUINTE ao fim
 * do anterior. Nenhum bloco excede 90 dias (`planejarBlocos` limita os meses).
 */
export function encadearDatas(inicioISO: string, blocos: BlocoPlano[]): BlocoComDatas[] {
  let cursor = inicioISO;
  return blocos.map((b) => {
    const inicio = cursor;
    const fim = fimInclusivoISO(inicio, b.meses * DIAS_POR_MES);
    cursor = addDiasISO(fim, 1);
    return { ...b, inicio, fim };
  });
}
