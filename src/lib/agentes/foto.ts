/** Imagem que já terminou de carregar mas sem pixels = arquivo ausente/corrompido (404 antes da hidratação). */
export function imagemQuebrada(img: { complete: boolean; naturalWidth: number } | null): boolean {
  return !!img && img.complete && img.naturalWidth === 0;
}
