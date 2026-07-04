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
  (aluguel e caução) vai para o proprietário / conta vinculada / emissor,
  NUNCA para a plataforma.
*/

/**
 * Fração da caução por bloco (50%). Espelha `PERC_CAUCAO` de `caucao.ts` — este
 * módulo é mantido SEM imports (como caucao.ts e guarantees.ts) para poder ser
 * testado com `node --test`, que não resolve o alias `@/`.
 */
export const PERC_CAUCAO_BLOCO = 0.5;

/** Tamanho padrão do bloco, em meses (configurável no fechamento). */
export const MESES_POR_BLOCO_PADRAO = 2;
/** Teto legal de dias por bloco (temporada — art. 48). */
export const MAX_DIAS_BLOCO = 90;
/** Dias por mês usados no encadeamento das datas (aproximação comercial). */
export const DIAS_POR_MES = 30;
/** Máximo de meses por bloco para não estourar 90 dias (90 / 30 = 3). */
export const MAX_MESES_BLOCO = Math.floor(MAX_DIAS_BLOCO / DIAS_POR_MES);

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
  while (restante > 0) {
    const meses = Math.min(passo, restante);
    const valor = aluguel * meses;
    const caucao = Math.round(valor * PERC_CAUCAO_BLOCO);
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
 * Encadeia as datas dos blocos a partir de um início (ISO). Cada bloco começa
 * onde o anterior termina; `fim = inicio + meses×30`. Garante que nenhum bloco
 * excede 90 dias (o próprio `planejarBlocos` já limita os meses).
 */
export function encadearDatas(inicioISO: string, blocos: BlocoPlano[]): BlocoComDatas[] {
  let cursor = inicioISO;
  return blocos.map((b) => {
    const inicio = cursor;
    const fim = addDiasISO(inicio, b.meses * DIAS_POR_MES);
    cursor = fim;
    return { ...b, inicio, fim };
  });
}
