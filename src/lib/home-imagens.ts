/**
 * Slots de imagem da home (ordem 86dcb4db, H1/H4). Os 4 passos usam fotos que nenhuma outra página pública usa
 * (t112, ordem 0f204e06: nada de imagem repetida entre / e /como-funciona). Enquanto não chegam fotos próprias de
 * cada passo, as legendas descrevem só o que a foto mostra. O fundo dos proprietários continua esperando a foto única
 * (public/images/unicas/home-proprietarios-fundo.webp; trocar `pronta` para true quando chegar).
 */
export const HOME_PASSOS_IMAGENS = [
  { src: "/images/unicas/cf-seguro-condominio.webp", alt: "Prédio residencial moderno com varandas e árvores na calçada", pronta: true },
  { src: "/images/dashboard/dash-inquilino-welcome.webp", alt: "Sala iluminada com poltrona azul, livro e xícara ao lado da janela", pronta: true },
  { src: "/images/dashboard/dash-prop-onboarding.webp", alt: "Sala mobiliada com sofá azul, mesa de centro e plantas", pronta: true },
  { src: "/images/app/app-boas-vindas.webp", alt: "Moradora com mala abrindo a porta do imóvel na chegada", pronta: true },
];
export const HOME_PROPRIETARIOS_FUNDO = {
  src: "/images/unicas/home-proprietarios-fundo.webp",
  pronta: false,
};

/** Quantos imóveis a home destaca: 4 (2x2 no celular), ou 2 quando há menos de 4. */
export function quantosDestaques(total: number): number {
  return total >= 4 ? 4 : Math.min(2, total);
}
