/*
  E1072 — os COMPONENTES do pagamento de um bloco. Puro, sem banco.
  O contrato diz o que o pagamento do bloco cobre: o aluguel do bloco, as contas do período (condomínio, consumo e as
  demais parcelas do mês) e, no 1º bloco, a limpeza de preparação. Na prova ao vivo de 20/11 só o aluguel tinha
  registro (R$ 2.583,33 de R$ 3.143,33): as contas e a limpeza não contavam para o quitado nem apareciam no pacote.
  Fonte única do que se espera (pelo contrato) e do que foi registrado (o valor + os encargos de cada pagamento).
*/
import { diasInclusivos } from "./contrato-blocos.ts";
import { ROTULO_PREPARACAO, primeiroPagamentoDoPreco, type PrecoRotulado } from "./precos.ts";

export const ROTULO_CONTAS = "Contas do período";
export const ROTULO_LIMPEZA = "Limpeza de preparação";

export interface Encargo {
  rotulo: string;
  valor: number;
}

export interface ComponentesBloco {
  aluguel: number;
  contas: number;
  limpeza: number;
  total: number;
}

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (n: number) => `R$ ${c2(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const SEM_COMPONENTES: ComponentesBloco = { aluguel: 0, contas: 0, limpeza: 0, total: 0 };

/**
 * Um só "em dias" (nota do desenho da pilha, ORDENS-DUET 1054 e 1095): a estadia conta-se em DIAS quando os dias dela
 * não fecham meses cheios. A fonte única da decisão: o fator do bloco e o 1º pagamento leem daqui (e o duracaoDoBloco
 * do E1067 lerá na fusão dele). Dias vazios, zero, negativos ou lixo: não é em dias (a conta de sempre, em meses).
 */
export function estadiaEmDias(dias: number | null | undefined): boolean {
  const d = Math.round(Number(dias));
  return Number.isFinite(d) && d > 0 && d % 30 !== 0;
}

/** Quanto da estadia cabe ao bloco: os meses do bloco ou, no contrato em dias, os dias do bloco ÷ 30. */
export function fatorDoBloco(b: { meses: number; inicio?: string | null; fim?: string | null }, prazoTotalDias: number): number {
  if (estadiaEmDias(prazoTotalDias) && b.inicio && b.fim) return diasInclusivos(b.inicio, b.fim) / 30;
  return Math.max(1, Number(b.meses) || 1);
}

/**
 * O que o contrato diz que CADA bloco custa. As contas da estadia inteira são repartidas pelo fator de cada bloco (o
 * último fica com o resto, para a soma bater no centavo); a limpeza de preparação entra no 1º bloco.
 * A soma dos blocos é o Total do contrato.
 */
export function componentesDosBlocos(e: {
  blocos: { numero: number; valor: number; fator: number }[];
  /** Tudo o que o contrato cobra além do aluguel e da limpeza de preparação, na estadia inteira. */
  contasDoContrato: number;
  limpezaPreparacao: number;
}): Map<number, ComponentesBloco> {
  const blocos = [...e.blocos].sort((a, b) => a.numero - b.numero);
  const contasTotal = Math.max(0, c2(e.contasDoContrato));
  const limpeza = Math.max(0, c2(e.limpezaPreparacao));
  const somaFator = blocos.reduce((s, b) => s + Math.max(0, b.fator), 0);
  const out = new Map<number, ComponentesBloco>();
  let repartido = 0;
  blocos.forEach((b, i) => {
    const ultimo = i === blocos.length - 1;
    const contas = ultimo ? c2(contasTotal - repartido) : somaFator > 0 ? c2((contasTotal * Math.max(0, b.fator)) / somaFator) : 0;
    repartido = c2(repartido + contas);
    const aluguel = c2(b.valor);
    const limpezaDoBloco = i === 0 ? limpeza : 0;
    out.set(b.numero, { aluguel, contas: Math.max(0, contas), limpeza: limpezaDoBloco, total: c2(aluguel + Math.max(0, contas) + limpezaDoBloco) });
  });
  return out;
}

/** Os encargos gravados com o pagamento: as contas e a limpeza, com o rótulo fixo de cada componente. */
export function encargosDosComponentes(c: { contas?: number | null; limpeza?: number | null }): Encargo[] {
  return [
    { rotulo: ROTULO_CONTAS, valor: c2(c.contas ?? 0) },
    { rotulo: ROTULO_LIMPEZA, valor: c2(c.limpeza ?? 0) },
  ].filter((x) => x.valor > 0);
}

const lista = (v: unknown): Encargo[] =>
  Array.isArray(v)
    ? (v as { rotulo?: unknown; valor?: unknown }[]).filter((x) => x && String(x.rotulo ?? "").trim() && Number(x.valor) > 0).map((x) => ({ rotulo: String(x.rotulo).trim(), valor: c2(Number(x.valor)) }))
    : [];

/** Os componentes de UM pagamento registrado. Encargo que não é a limpeza de preparação conta como contas (rótulos antigos). */
export function componentesDoPagamento(p: { valor: number | string; encargos?: unknown }): ComponentesBloco {
  const enc = lista(p.encargos);
  const limpeza = c2(enc.filter((x) => x.rotulo === ROTULO_LIMPEZA).reduce((s, x) => s + x.valor, 0));
  const contas = c2(enc.filter((x) => x.rotulo !== ROTULO_LIMPEZA).reduce((s, x) => s + x.valor, 0));
  const aluguel = c2(Number(p.valor));
  return { aluguel, contas, limpeza, total: c2(aluguel + contas + limpeza) };
}

/** A soma de vários pagamentos do mesmo bloco. */
export function somarComponentes(itens: ComponentesBloco[]): ComponentesBloco {
  const s = itens.reduce((a, x) => ({ aluguel: a.aluguel + x.aluguel, contas: a.contas + x.contas, limpeza: a.limpeza + x.limpeza, total: 0 }), { ...SEM_COMPONENTES });
  return { aluguel: c2(s.aluguel), contas: c2(s.contas), limpeza: c2(s.limpeza), total: c2(s.aluguel + s.contas + s.limpeza) };
}

/** O que ainda falta registrar, componente a componente. O bloco só está quitado quando não falta nenhum. */
export function emAbertoNoBloco(esperado: ComponentesBloco, registrado: ComponentesBloco): ComponentesBloco & { quitado: boolean } {
  const falta = (a: number, b: number) => Math.max(0, c2(a - b));
  const aluguel = falta(esperado.aluguel, registrado.aluguel);
  const contas = falta(esperado.contas, registrado.contas);
  const limpeza = falta(esperado.limpeza, registrado.limpeza);
  const total = c2(aluguel + contas + limpeza);
  return { aluguel, contas, limpeza, total, quitado: total < 0.005 };
}

/** "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33"; só o valor do bloco → "". */
export function textoComponentes(c: ComponentesBloco): string {
  if (c.contas <= 0 && c.limpeza <= 0) return "";
  // Registro complementar sem aluguel: não se escreve "aluguel R$ 0,00".
  // Vocabulário da casa: nas telas diz-se "valor do bloco", não "aluguel" (sem-aluguel-texto.test.ts).
  const partes = c.aluguel > 0 ? [`valor do bloco ${brl(c.aluguel)}`] : [];
  if (c.contas > 0) partes.push(`${ROTULO_CONTAS.toLowerCase()} ${brl(c.contas)}`);
  if (c.limpeza > 0) partes.push(`${ROTULO_LIMPEZA.toLowerCase()} ${brl(c.limpeza)}`);
  return partes.length > 1 ? `${partes.join(" + ")} = ${brl(c.total)}` : partes[0];
}

/**
 * As contas da estadia inteira, pela conta que as partes aceitaram.
 * Com proposta acordada: o Total do contrato da proposta, menos o aluguel dos blocos e a limpeza de preparação.
 * Sem proposta: as parcelas do mês congeladas no contrato × o fator da estadia.
 */
export function contasDoContrato(e: { totalContratoDaProposta?: number | null; aluguelDosBlocos: number; limpezaPreparacao: number; extrasMesCongelados?: number | null; fatorDaEstadia: number }): number {
  if (e.totalContratoDaProposta != null && Number.isFinite(e.totalContratoDaProposta) && e.totalContratoDaProposta > 0)
    return Math.max(0, c2(e.totalContratoDaProposta - e.aluguelDosBlocos - Math.max(0, e.limpezaPreparacao)));
  return Math.max(0, c2((Number(e.extrasMesCongelados) || 0) * Math.max(0, e.fatorDaEstadia)));
}

/**
 * E1072 (fatia 2): a parte do próximo registro do bloco — 1 no primeiro; a seguinte à maior parte ATIVA em cada
 * registro complementar. A parte anulada não conta, e uma parte ativa nunca se repete (o índice único recusa).
 */
export function proximaParte(partesAtivas: number[]): number {
  const validas = partesAtivas.map((p) => Math.floor(Number(p))).filter((p) => Number.isFinite(p) && p >= 1);
  return validas.length ? Math.max(...validas) + 1 : 1;
}

/**
 * E1072 (fatia 2; ORDEM-DUET-1104, julgamento 3 do coordenador): a parte de um registro tem UMA fonte, a coluna `parte`
 * registada (0348). As leituras (telas, recibo, pacote de provas) usam esta; vazia, zero ou lixo → 1 (o 1º registro).
 */
export function parteDaColuna(v: unknown): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** O que as telas de antes do contrato sabem da estadia (Fechamento e proposta). */
export interface EstadiaParaPrimeiroPagamento {
  /** Os dias da estadia, quando ela é contada em dias; null/0 quando é em meses. */
  dias: number | null | undefined;
  preco: Pick<PrecoRotulado, "mensal" | "totalPorMes" | "totalContrato" | "unicos">;
  blocos: { numero: number; valor: number; meses: number; dias?: number }[];
  /** Com proposta acordada, as contas saem do Total do contrato dela; sem ela, das parcelas do mês × os dias ÷ 30. */
  comProposta: boolean;
}

/**
 * E1072 (fatia 3; ORDEM-DUET-352): os componentes do 1º pagamento na estadia em DIAS que não fecha meses cheios — o 1º
 * bloco inteiro, pela MESMA conta do registro do bloco: o valor do bloco + as contas do período dele + a limpeza de
 * preparação. null em meses inteiros (a conta de sempre: o 1º mês com tudo + a limpeza de preparação).
 */
export function componentesDoPrimeiroPagamento(e: EstadiaParaPrimeiroPagamento): ComponentesBloco | null {
  if (!estadiaEmDias(e.dias) || e.blocos.length === 0) return null;
  const dias = Math.round(Number(e.dias));
  const limpeza = c2(e.preco.unicos.filter((u) => u.rotulo === ROTULO_PREPARACAO).reduce((s, u) => s + u.valor, 0));
  const blocos = [...e.blocos].sort((a, b) => a.numero - b.numero).map((b) => ({ numero: b.numero, valor: b.valor, fator: (b.dias ?? b.meses * 30) / 30 }));
  const contas = contasDoContrato({
    totalContratoDaProposta: e.comProposta ? e.preco.totalContrato : null,
    aluguelDosBlocos: c2(blocos.reduce((s, b) => s + b.valor, 0)),
    limpezaPreparacao: limpeza,
    extrasMesCongelados: e.preco.totalPorMes - e.preco.mensal,
    fatorDaEstadia: dias / 30,
  });
  return componentesDosBlocos({ blocos, contasDoContrato: contas, limpezaPreparacao: limpeza }).get(blocos[0].numero) ?? null;
}

/**
 * O "1º pagamento" que as telas mostram antes do contrato: em dias, o 1º bloco inteiro (R$ 3.143,33 no contrato
 * provado, não R$ 3.050,00); em meses inteiros, o 1º mês com tudo + a limpeza de preparação.
 */
export function primeiroPagamentoDaEstadia(e: EstadiaParaPrimeiroPagamento): number {
  return componentesDoPrimeiroPagamento(e)?.total ?? primeiroPagamentoDoPreco(e.preco);
}

/** A conta do 1º pagamento por extenso, só na estadia em dias ("" em meses: as parcelas do mês da tela já somam). */
export function contaDoPrimeiroPagamento(e: EstadiaParaPrimeiroPagamento): string {
  const c = componentesDoPrimeiroPagamento(e);
  return c ? textoComponentes(c) : "";
}
