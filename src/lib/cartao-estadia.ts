/*
  E756 (Phoenix/RELATORIO-004, C5; reprovado ao vivo em 11/11): "R$ X em N meses" tinha regra diferente por superfície. O cartão
  da busca e o detalhe, com 1 mês, mostravam o total do MÊS (sem as limpezas de preparação e de saída); com N > 1 já somavam;
  a prévia da revisão do dono somava sempre; mapa, favoritos, comparar e o painel faziam mês × N. No ube-001: R$ 3.960 em
  1 mês no cartão contra R$ 4.660 na conta da própria página.
  Regra ÚNICA (a do E777/E254-A, estadiaDoImovel): total em N meses = N × total do mês + limpeza de preparação + limpeza
  de saída, para QUALQUER N ≥ 1. O "/mês" segue sendo o total do mês (o que se paga todo mês). O cartão mostra a conta
  aberta ("2 × R$ 4.100 + limpeza de preparação R$ 450 + limpeza de saída R$ 250"). PURO.
*/
import { calcularTudoIncluido, estadiaDoImovel, parcelasDoMes, type CamposTotalMes } from "./precos.ts";
import { formatBRL } from "./utils.ts";
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

/** E756 (escopo ampliado): a composição do "/mês" do cartão, pela fonte única do total do mês (calcularTudoIncluido +
 *  parcelasDoMes). A regra é a mesma para todo anúncio; o que muda é o dado: com condomínio, contas fixas ou pacote de limpeza,
 *  a soma aberta ("Por mês: valor mensal R$ 3.200 + condomínio R$ 480 + contas R$ 280 = R$ 3.960"); com as contas medidas,
 *  o aviso de que ficam fora do total. */
export function composicaoDoMes(p: CamposTotalMes): string {
  const m = calcularTudoIncluido(p);
  const pacote = m.limpezaMes > 0 && p.limpezaEstadia ? ` (${p.limpezaEstadia.porMes} por mês)` : "";
  const soma = m.temExtras ? `${parcelasDoMes(m)}${pacote} = ${formatBRL(m.total)}` : parcelasDoMes(m);
  const medidas = p.utilitiesMode === "fixed" ? "" : " · água, luz e gás medidos à parte, fora do total";
  return `Por mês: ${soma}${medidas}`;
}
