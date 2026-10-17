/**
 * Selos do card de imóvel (ordem 86dcb4db, B1): no máximo 2 sobre a foto, na
 * ordem de prioridade abaixo; os demais vão para a linha de baixo do card.
 */
export type SeloCard = "precoJusto" | "pets" | "pronto" | "video" | "exemplo" | "destaque";

export const MAX_SELOS_NA_FOTO = 2;

/** Texto do selo de vídeo (ordem 6f964617, tela 7). */
export const ROTULO_SELO_VIDEO = "Tour em vídeo";

/** Ordem de prioridade: Preço justo, Aceita pets, depois os demais. */
const ORDEM: SeloCard[] = ["precoJusto", "pets", "pronto", "video", "exemplo", "destaque"];

export function repartirSelos(ativos: Partial<Record<SeloCard, boolean>>): {
  foto: SeloCard[];
  linha: SeloCard[];
} {
  const lista = ORDEM.filter((s) => ativos[s]);
  return { foto: lista.slice(0, MAX_SELOS_NA_FOTO), linha: lista.slice(MAX_SELOS_NA_FOTO) };
}
