/**
 * Imagens da home (ordem 86dcb4db, H1/H4). Os 4 passos ficam SEM foto: as únicas fotos reais livres já estão em
 * /como-funciona e outras páginas, e o t112 proíbe repetir imagem entre páginas (regressão 0f204e06). Quando
 * houver 4 fotos próprias dos passos, voltar a incluí-las aqui. O fundo dos proprietários continua esperando a foto
 * única (public/images/unicas/home-proprietarios-fundo.webp; trocar `pronta` para true quando chegar).
 */
export const HOME_PROPRIETARIOS_FUNDO = {
  src: "/images/unicas/home-proprietarios-fundo.webp",
  pronta: false,
};

/** Quantos imóveis a home destaca: 4 (2x2 no celular), ou 2 quando há menos de 4. */
export function quantosDestaques(total: number): number {
  return total >= 4 ? 4 : Math.min(2, total);
}
