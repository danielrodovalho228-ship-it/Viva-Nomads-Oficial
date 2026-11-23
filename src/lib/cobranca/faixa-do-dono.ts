/*
  E628 — o simulador LOGADO do dono nomeia a própria faixa. PURO: o nome vem de rotuloFaixaTaxa (regra de cobrança).
  Prompt 078 (16/11/2026): a faixa do Gestor saiu da escada; não há mais detalhe próprio de faixa.
*/
import { rotuloFaixaTaxa, type FaixaComissao } from "./regra.ts";

export interface FaixaDoDono {
  /** O rótulo da faixa de rotuloFaixaTaxa, com "imóveis" ("3–5 imóveis", "16–19 imóveis"). */
  nome: string;
}

export function faixaDoDono(f: FaixaComissao): FaixaDoDono {
  return { nome: rotuloFaixaTaxa(f, true) };
}
