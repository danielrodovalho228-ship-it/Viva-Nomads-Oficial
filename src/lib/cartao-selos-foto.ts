/*
  E626 (estudo de selos aprovado pelo Daniel, 06/11): o cartão de busca mostra no MÁXIMO 2 pílulas sobre a foto.
   • Pílula 1 = o nível em palavra (Essencial · Conforto · Premium), cada um na sua cor. Sem nível confirmado (nulo ou "em
     adequação"), não há pílula 1. Sem "· vistoriado" no cartão (a página do imóvel segue contando isso).
   • Pílula 2 = branca, SÓ símbolos, nesta ordem: verificado, preço justo, pets, negociação. Cada símbolo leva o texto
     completo (aria-label e title). Sem nenhum, não há pílula 2.
  Substitui o E416 (todos os selos em fileira, ícone + texto). PURO.
*/
import { ROTULO_NIVEL, type Nivel, type NivelOuAdequacao } from "../config/niveis.ts";
import { ROTULO_SELO_UNICO } from "./card-selos.ts";

export type SimboloFoto = "verificado" | "precoJusto" | "pets" | "negocia";

export const ROTULO_NEGOCIA = "Aceita negociação";

/** Ordem dos símbolos da pílula 2 e o texto completo de cada um. */
export const ORDEM_SIMBOLOS: readonly SimboloFoto[] = ["verificado", "precoJusto", "pets", "negocia"];
export const ROTULO_SIMBOLO: Record<SimboloFoto, string> = {
  verificado: ROTULO_SELO_UNICO.verificado,
  precoJusto: ROTULO_SELO_UNICO.precoJusto,
  pets: ROTULO_SELO_UNICO.pets,
  negocia: ROTULO_NEGOCIA,
};

export interface SelosDoCartao {
  nivel: { id: Nivel; rotulo: string } | null;
  simbolos: { id: SimboloFoto; rotulo: string }[];
}

export function selosDaFoto(p: {
  verificado?: boolean;
  precoJusto?: boolean;
  pets?: boolean;
  nivel?: NivelOuAdequacao | null;
  /** Mantido por compatibilidade com quem chama; o cartão não mostra mais o "· vistoriado". */
  nivelVistoriado?: boolean | null;
  negocia?: boolean;
}): SelosDoCartao {
  const tem: Record<SimboloFoto, boolean> = { verificado: !!p.verificado, precoJusto: !!p.precoJusto, pets: !!p.pets, negocia: !!p.negocia };
  return {
    nivel: p.nivel && p.nivel !== "em_adequacao" ? { id: p.nivel, rotulo: ROTULO_NIVEL[p.nivel] } : null,
    simbolos: ORDEM_SIMBOLOS.filter((id) => tem[id]).map((id) => ({ id, rotulo: ROTULO_SIMBOLO[id] })),
  };
}

/** Quantas pílulas o cartão desenha (0, 1 ou 2). */
export function pilulasDoCartao(s: SelosDoCartao): number {
  return (s.nivel ? 1 : 0) + (s.simbolos.length > 0 ? 1 : 0);
}
