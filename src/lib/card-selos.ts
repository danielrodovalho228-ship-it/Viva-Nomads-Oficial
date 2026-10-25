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

/*
  Adendo do Prompt 40 (substitui a B1 de 86dcb4db no cartão de anúncio): NO MÁXIMO 1 selo por
  cartão, em pill branca com o nome. Prioridade: Proprietário verificado → Preço justo → Aceita pets.
  O `repartirSelos` acima fica para quem ainda o usa; o cartão usa `seloDoCartao`.
*/
export type SeloUnico = "verificado" | "precoJusto" | "pets";

export const ROTULO_SELO_UNICO: Record<SeloUnico, string> = {
  verificado: "Proprietário verificado",
  precoJusto: "Preço justo",
  pets: "Aceita pets",
};

const ORDEM_UNICO: SeloUnico[] = ["verificado", "precoJusto", "pets"];

export function seloDoCartao(ativos: Partial<Record<SeloUnico, boolean>>): SeloUnico | null {
  return ORDEM_UNICO.find((s) => ativos[s]) ?? null;
}
