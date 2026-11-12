/*
  E756 (Phoenix/RELATORIO-004, C5; reprovado ao vivo em 11/11): "R$ X em N meses" tinha regra diferente por superfície. O cartão
  da busca e o detalhe, com 1 mês, mostravam o total do MÊS (sem as limpezas de preparação e de saída); com N > 1 já somavam;
  a prévia da revisão do dono somava sempre; mapa, favoritos, comparar e o painel faziam mês × N. No ube-001: R$ 3.960 em
  1 mês no cartão contra R$ 4.660 na conta da própria página.
  Regra ÚNICA (a do E777/E254-A, estadiaDoImovel): total em N meses = N × total do mês + limpeza de preparação + limpeza
  de saída, para QUALQUER N ≥ 1. O "/mês" segue sendo o total do mês (o que se paga todo mês). O cartão mostra a conta
  aberta ("2 × R$ 4.100 + limpeza de preparação R$ 450 + limpeza de saída R$ 250"). PURO.
*/
import { calcularTudoIncluido, estadiaDoImovel } from "./precos.ts";
import { resumoEmMeses, rotuloPreco, type RotuloPreco } from "./cartao-preco.ts";

type CamposDoAnuncio = Parameters<typeof estadiaDoImovel>[0];

export interface EstadiaNoCartao {
  /** "R$ 8.900 em 2 meses" */
  texto: string;
  total: number;
  meses: number;
  /** A conta aberta: "2 × R$ 4.100 + limpeza de preparação R$ 450 + limpeza de saída R$ 250" (com N ≥ 1). */
  composicao: string;
}

/** O total da estadia do cartão com N ≥ 1 meses, pela regra única; sem total possível, null. */
export function estadiaNoCartao(p: CamposDoAnuncio, meses: number): EstadiaNoCartao | null {
  if (!(meses >= 1)) return null;
  const e = estadiaDoImovel(p, Math.floor(meses));
  if (!e) return null;
  return { texto: resumoEmMeses(e.total, e.meses), total: e.total, meses: e.meses, composicao: e.conta };
}

/** E756: o rótulo de preço de um ANÚNCIO para qualquer lista ("R$ X/mês · R$ Y em N meses"): o /mês é o total do mês e o
 *  "em N meses" é o da regra única (com as limpezas únicas), também com 1 mês. Substitui rotuloPreco({ mensal, meses }) onde há
 *  um anúncio. */
export function rotuloPrecoDoImovel(
  p: CamposDoAnuncio & { availableFrom?: string | null },
  opts: { meses: number; disponivelEm?: string | null; hoje?: Date },
): RotuloPreco & { composicao: string | null } {
  const base = rotuloPreco({ mensal: calcularTudoIncluido(p).total, meses: opts.meses, disponivelEm: opts.disponivelEm ?? p.availableFrom ?? null, hoje: opts.hoje });
  const e = estadiaNoCartao(p, base.meses);
  if (!e) return { ...base, composicao: null };
  return { ...base, total: e.total, estadia: e.texto, composicao: e.composicao };
}
