/*
  E416 (ordem do Daniel, 05/11): os selos sobre a foto do cartão de anúncio — TODOS os que o imóvel tem, empilhados em
  fileira, cada um com ícone + texto. Ordem do pedido: Preço justo, Aceita pets, o nível (Essencial/Conforto/Premium) e
  Aceita negociação; o "Proprietário verificado" (que já era selo) vai primeiro. Substitui o "no máximo 1 selo" do adendo
  do Prompt 40 (`seloDoCartao`, que fica em card-selos.ts para quem ainda o usa). PURO.
*/
import { ROTULO_NIVEL, type NivelOuAdequacao } from "../config/niveis.ts";
import { ROTULO_SELO_UNICO } from "./card-selos.ts";
import { textoNivelCartao } from "./cartao-sintese.ts";

export type SeloFoto = "verificado" | "precoJusto" | "pets" | "nivel" | "negocia";

export const ROTULO_NEGOCIA = "Aceita negociação";

export function selosDaFoto(p: {
  verificado?: boolean;
  precoJusto?: boolean;
  pets?: boolean;
  nivel?: NivelOuAdequacao | null;
  nivelVistoriado?: boolean | null;
  negocia?: boolean;
}): { id: SeloFoto; rotulo: string }[] {
  const s: { id: SeloFoto; rotulo: string }[] = [];
  if (p.verificado) s.push({ id: "verificado", rotulo: ROTULO_SELO_UNICO.verificado });
  if (p.precoJusto) s.push({ id: "precoJusto", rotulo: ROTULO_SELO_UNICO.precoJusto });
  if (p.pets) s.push({ id: "pets", rotulo: ROTULO_SELO_UNICO.pets });
  if (p.nivel && p.nivel !== "em_adequacao") s.push({ id: "nivel", rotulo: textoNivelCartao(ROTULO_NIVEL[p.nivel], !!p.nivelVistoriado) });
  if (p.negocia) s.push({ id: "negocia", rotulo: ROTULO_NEGOCIA });
  return s;
}
