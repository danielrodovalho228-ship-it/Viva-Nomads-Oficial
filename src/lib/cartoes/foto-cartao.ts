import sharp from "sharp";

/** Maior arquivo de foto aceito para o cartão (o que passar disso sai com o fundo da marca). */
export const FOTO_CARTAO_MAX_BYTES = 6_000_000;
/** Largura máxima da foto convertida: o cartão tem 1080 px de largura. */
export const FOTO_CARTAO_LARGURA = 1080;
export const FOTO_CARTAO_QUALIDADE = 82;

/**
 * Foto do cartão como data URI que o ImageResponse (satori) consegue desenhar. O satori só desenha JPEG e PNG: WebP
 * (o formato em que as fotos de imóvel e de parceiro são gravadas) derruba a renderização ("u2 is not iterable") e a
 * rota responderia 500. JPEG e PNG passam como estão; qualquer outra imagem vira JPEG pelo sharp (gira pela câmera,
 * reduz a 1080 px). Arquivo que não decodifica → null, e o cartão sai com o fundo da marca.
 */
export async function fotoParaCartao(bytes: Uint8Array, contentType: string): Promise<string | null> {
  if (!bytes.length || bytes.length > FOTO_CARTAO_MAX_BYTES) return null;
  const tipo = contentType.split(";")[0].trim().toLowerCase();
  if (!tipo.startsWith("image/")) return null;
  try {
    if (tipo === "image/jpeg" || tipo === "image/png") {
      // Confere que decodifica de verdade antes de entregar ao satori (cabeçalho de foto com conteúdo falso → null).
      await sharp(bytes).metadata();
      return `data:${tipo};base64,${Buffer.from(bytes).toString("base64")}`;
    }
    const jpeg = await sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: FOTO_CARTAO_LARGURA, withoutEnlargement: true })
      .jpeg({ quality: FOTO_CARTAO_QUALIDADE })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}
