/*
  E925 (Phoenix, A-254; esclarecimento do Gerente): na página do imóvel convivem duas notas — a do imóvel (no topo) e a do
  proprietário (no bloco "Sobre o proprietário") — e as duas diziam só "N avaliações". Cada uma passa a dizer de quem é.
  Os números e a fonte de cada nota não mudam: aqui só se escreve o rótulo. PURO.
*/
import { numBR } from "../utils.ts";

export type DonoDaNota = "imovel" | "proprietario";

const DE_QUEM: Record<DonoDaNota, string> = { imovel: "do imóvel", proprietario: "do proprietário" };

/** "avaliações do imóvel" / "avaliação do proprietário" (singular com 1). */
export function rotuloAvaliacoes(n: number, de: DonoDaNota): string {
  return `${n === 1 ? "avaliação" : "avaliações"} ${DE_QUEM[de]}`;
}

/** "4,7 · 11 avaliações do proprietário": a média com uma casa, a contagem e o rótulo de quem é a nota. */
export function textoDaNota(media: number, n: number, de: DonoDaNota): string {
  return `${numBR(media, 1)} · ${n} ${rotuloAvaliacoes(n, de)}`;
}
