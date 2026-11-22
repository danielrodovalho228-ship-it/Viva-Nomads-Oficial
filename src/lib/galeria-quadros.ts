/*
  E987 (t707) — a galeria aberta reaproveita a versão JÁ BAIXADA do quadro de onde a foto veio. O E768 deu às fotos
  pequenas do mosaico do computador um `sizes` próprio (versão do tamanho do quadro), e a camada de baixo da galeria
  seguia pedindo a versão da miniatura grande: URL diferente, nada no cache, painel em branco nas fotos 2–5 (o E262
  regrediu). Esta é a fonte única do tipo do quadro: o mosaico e a galeria usam o mesmo.
  No celular os três tipos dão 100vw (a mesma URL do carrossel).
*/
export type TipoQuadro = "miniatura" | "pequena" | "coluna";

/**
 * O tipo do quadro da foto `indice` num mosaico de `total` fotos (1 foto: só a capa; 2–4: capa + coluna; 5+: capa + 4
 * pequenas). `noMosaico` = a galeria foi aberta a partir do mosaico do computador; no celular a foto vem do carrossel,
 * que usa a miniatura em todas.
 */
export function tipoDoQuadro(indice: number, total: number, noMosaico = true): TipoQuadro {
  if (!noMosaico || indice <= 0 || total <= 1) return "miniatura";
  if (total < 5) return indice < total ? "coluna" : "miniatura";
  return indice <= 4 ? "pequena" : "miniatura"; // da 6ª em diante a foto não está no mosaico ("+N mais")
}
