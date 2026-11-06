/*
  E628 (complemento do E564) — o simulador LOGADO do dono nomeia a própria faixa, inclusive a do Gestor. A /simulacao pública já mostrava
  "Gestor: 20+ imóveis ou administradora · cadastro assistido e contato direto" (E623); o simulador do dono só dizia "taxa de serviço 4%", e o
  controle de imóveis ativos termina justamente em 20, a faixa do Gestor: o dono com 20+ imóveis não via o nome da própria faixa onde simula.
  PURO: o nome vem de rotuloFaixaTaxa (regra de cobrança) e o detalhe do Gestor das MESMAS TAXA_FAIXAS da /simulacao — nenhum texto próprio.
*/
import { rotuloFaixaTaxa, type FaixaComissao } from "./regra.ts";
import { TAXA_FAIXAS } from "../../config/premissas-financeiras.ts";

export interface FaixaDoDono {
  /** "3–5 imóveis" · "20+ imóveis · Plano Gestor". */
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
