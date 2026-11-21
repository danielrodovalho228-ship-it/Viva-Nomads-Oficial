/*
  E1072 — os COMPONENTES do pagamento de um bloco. Puro, sem banco.
  O contrato diz o que o pagamento do bloco cobre: o aluguel do bloco, as contas do período (condomínio, consumo e as
  demais parcelas do mês) e, no 1º bloco, a limpeza de preparação. Na prova ao vivo de 20/11 só o aluguel tinha
  registro (R$ 2.583,33 de R$ 3.143,33): as contas e a limpeza não contavam para o quitado nem apareciam no pacote.
  Fonte única do que se espera (pelo contrato) e do que foi registrado (o valor + os encargos de cada pagamento).
*/
import { diasInclusivos } from "./contrato-blocos.ts";

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

/** Quanto da estadia cabe ao bloco: os meses do bloco ou, no contrato em dias, os dias do bloco ÷ 30. */
export function fatorDoBloco(b: { meses: number; inicio?: string | null; fim?: string | null }, prazoTotalDias: number): number {
  const emDias = Number.isFinite(prazoTotalDias) && prazoTotalDias > 0 && prazoTotalDias % 30 !== 0;
  if (emDias && b.inicio && b.fim) return diasInclusivos(b.inicio, b.fim) / 30;
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

/** "aluguel R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33"; só aluguel → "". */
export function textoComponentes(c: ComponentesBloco): string {
  if (c.contas <= 0 && c.limpeza <= 0) return "";
  const partes = [`aluguel ${brl(c.aluguel)}`];
  if (c.contas > 0) partes.push(`${ROTULO_CONTAS.toLowerCase()} ${brl(c.contas)}`);
  if (c.limpeza > 0) partes.push(`${ROTULO_LIMPEZA.toLowerCase()} ${brl(c.limpeza)}`);
  return `${partes.join(" + ")} = ${brl(c.total)}`;
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
