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
import { isExemplo } from "./demo-listing.ts";

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

/*
  E811 — FONTE ÚNICA dos selos de um imóvel: o cartão da busca e a página do anúncio chamam esta função, então mostram os
  MESMOS selos. O critério de cada selo fica visível na página (CRITERIO_SIMBOLO). Exemplo nunca leva "verificado".
*/
export function simbolosDoImovel(p: {
  id: string;
  owner?: { verified?: boolean } | null;
  precoJusto?: boolean;
  petsAllowed?: boolean;
  negociacao?: { aceita?: boolean } | null;
}): Record<SimboloFoto, boolean> {
  return {
    verificado: !isExemplo(p.id) && p.owner?.verified === true,
    precoJusto: !!p.precoJusto,
    pets: p.petsAllowed === true,
    negocia: !!p.negociacao?.aceita,
  };
}

/** O critério objetivo de cada selo, dito por inteiro na página do anúncio. */
export const CRITERIO_SIMBOLO: Record<SimboloFoto, string> = {
  verificado: "a equipe conferiu a identidade do proprietário (não garante o imóvel)",
  precoJusto: "o valor mensal fica abaixo do equivalente mensal que o proprietário informou ter no Airbnb",
  pets: "o proprietário aceita animais; as condições estão nas regras da estadia",
  negocia: "o proprietário aceita receber proposta de valor",
};
