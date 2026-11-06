/*
  E628 (complemento do E564) — o simulador LOGADO do dono nomeia a própria faixa, inclusive a do Gestor. A /simulacao pública já mostrava a faixa
  do Gestor com o que ela traz (E623); o simulador do dono só dizia a taxa, e o controle de imóveis ativos termina justamente na faixa do Gestor:
  o dono com carteira desse tamanho não via o nome da própria faixa onde simula.
  PURO: o nome vem de rotuloFaixaTaxa (regra de cobrança) e o detalhe do Gestor das MESMAS TAXA_FAIXAS da /simulacao — nenhum texto nem número
  próprio (o mínimo do Gestor é GESTOR_PRECO.minimoImoveis, um só).
*/
import { rotuloFaixaTaxa, type FaixaComissao } from "./regra.ts";
import { TAXA_FAIXAS } from "../../config/premissas-financeiras.ts";

export interface FaixaDoDono {
  /** O rótulo da faixa de rotuloFaixaTaxa, com "imóveis" (a do Gestor leva o nome do plano). */
  nome: string;
  /** Só na faixa do Gestor: quem entra e o que a faixa traz além da taxa (o texto da /simulacao). */
  gestor: { carteira: string; detalhe: string } | null;
}

export function faixaDoDono(f: FaixaComissao): FaixaDoDono {
  const nome = rotuloFaixaTaxa(f, true);
  if (!f.gestor) return { nome, gestor: null };
  const linha = TAXA_FAIXAS.find((t) => t.detalhe && t.taxa === f.taxa);
  return { nome, gestor: linha?.detalhe ? { carteira: linha.carteira, detalhe: linha.detalhe } : null };
}
