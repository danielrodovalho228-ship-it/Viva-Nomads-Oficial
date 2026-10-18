/**
 * Slots de imagem da home (ordem 86dcb4db, H1/H4). Os 4 passos usam as MESMAS fotos reais de /como-funciona (QA do
 * Muse, 18/10: nada de "Foto do passo em breve"). O fundo dos proprietários continua esperando a foto única
 * (public/images/unicas/home-proprietarios-fundo.webp; trocar `pronta` para true quando chegar).
 */
export const HOME_PASSOS_IMAGENS = [
  { src: "/images/como-funciona/01-busque.webp", alt: "Profissional pesquisando imóveis mobiliados no notebook", pronta: true },
  { src: "/media/como-funciona-01-converse.webp", alt: "Mulher jovem sorrindo no laptop, conversando pela plataforma", pronta: true },
  { src: "/media/como-funciona-02-assine.webp", alt: "Homem assinando o contrato pelo celular", pronta: true },
  { src: "/media/como-funciona-04-chaves.webp", alt: "Casal recebendo as chaves do imóvel na chegada", pronta: true },
];
export const HOME_PROPRIETARIOS_FUNDO = {
  src: "/images/unicas/home-proprietarios-fundo.webp",
  pronta: false,
};

/** Quantos imóveis a home destaca: 4 (2x2 no celular), ou 2 quando há menos de 4. */
export function quantosDestaques(total: number): number {
  return total >= 4 ? 4 : Math.min(2, total);
}
