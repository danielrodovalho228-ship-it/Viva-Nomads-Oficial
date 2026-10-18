import sharp from "sharp";

/** Lado maior da foto salva: acima disso reduz (celulares mandam 4000+ px; a galeria mostra bem menos). */
export const FOTO_LADO_MAX_PX = 2560;
export const FOTO_QUALIDADE_WEBP = 82;

/**
 * Re-codifica a foto do anúncio NO SERVIDOR: gira pela orientação da câmera, reduz se for enorme e grava como WebP.
 * O sharp não copia metadados por padrão, então EXIF (GPS, modelo da câmera, nome do dono) não chega ao arquivo salvo;
 * e, como a imagem é decodificada de verdade, um arquivo com cabeçalho de foto mas conteúdo falso devolve null.
 */
export async function reconverterFotoParaWebp(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const saida = await sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: FOTO_LADO_MAX_PX, height: FOTO_LADO_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: FOTO_QUALIDADE_WEBP })
      .toBuffer();
    return new Uint8Array(saida);
  } catch {
    return null;
  }
}
