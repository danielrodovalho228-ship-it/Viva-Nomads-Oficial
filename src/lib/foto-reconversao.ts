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

/**
 * Hash perceptual (dHash 64 bits, 16 hex) da foto, calculado NO SERVIDOR (Prompt 58): 9×8 em tons de cinza, cada bit diz
 * se o pixel é mais claro que o vizinho da direita. Fotos iguais ou quase iguais dão hashes a poucos bits de distância.
 * Guarda-se só o hash (antifraude, sobrevive à remoção do anúncio); null se a imagem não abrir.
 */
export async function hashPerceptual(bytes: Uint8Array): Promise<string | null> {
  try {
    const px = await sharp(bytes, { limitInputPixels: 100_000_000 }).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    // 8 linhas × 8 bits = 8 bytes → 16 hex (sem BigInt).
    let hex = "";
    for (let y = 0; y < 8; y++) {
      let b = 0;
      for (let x = 0; x < 8; x++) b = (b << 1) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0);
      hex += b.toString(16).padStart(2, "0");
    }
    return hex;
  } catch {
    return null;
  }
}

const MIMES_IMAGEM: Record<string, "jpeg" | "png" | "webp"> = { "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/png": "png", "image/webp": "webp" };

/**
 * Tira EXIF/GPS de QUALQUER imagem enviada (Prompt 58, item 6), mantendo o formato: decodifica e re-codifica (o sharp
 * não copia metadados), aplicando a orientação da câmera. Arquivo que não é imagem (PDF, ZIP, áudio) volta igual.
 * Imagem que não abre: null (quem chama recusa o envio).
 */
export async function semMetadados(bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  const formato = MIMES_IMAGEM[mime.toLowerCase()];
  if (!formato) return bytes;
  try {
    const img = sharp(bytes, { limitInputPixels: 100_000_000 }).rotate();
    const saida = formato === "jpeg" ? await img.jpeg({ quality: 88 }).toBuffer() : formato === "png" ? await img.png().toBuffer() : await img.webp({ quality: FOTO_QUALIDADE_WEBP }).toBuffer();
    return new Uint8Array(saida);
  } catch {
    return null;
  }
}
