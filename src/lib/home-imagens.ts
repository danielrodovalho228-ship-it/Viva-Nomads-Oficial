/**
 * Slots de imagem da home (ordem 86dcb4db, H1/H4). As fotos são únicas e vêm da
 * coordenação: coloque o arquivo em public/images/unicas/ e troque `pronta` para
 * true. Enquanto isso a home mostra um espaço marcado (nunca imagem quebrada).
 * FALTA IMAGEM: home-passo-1..4.webp e home-proprietarios-fundo.webp.
 */
export const HOME_PASSOS_IMAGENS = [1, 2, 3, 4].map((n) => ({
  src: `/images/unicas/home-passo-${n}.webp`,
  pronta: false,
}));
export const HOME_PROPRIETARIOS_FUNDO = {
  src: "/images/unicas/home-proprietarios-fundo.webp",
  pronta: false,
};

/** Quantos imóveis a home destaca: 4 (2x2 no celular), ou 2 quando há menos de 4. */
export function quantosDestaques(total: number): number {
  return total >= 4 ? 4 : Math.min(2, total);
}
