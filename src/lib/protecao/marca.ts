import sharp from "sharp";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { marcaTexto, svgMarca } from "./visualizacao.ts";

/*
  E640 (c) — desenha a marca visível (nome de quem vê + data) na imagem ou no PDF ANTES de servir. Só o servidor chama.
  A imagem sai em resolução de tela, sem metadados; o arquivo guardado nunca é servido como está.
*/
const LADO_MAX = 1600;

export async function marcarImagem(bytes: Uint8Array, nome: string, agora: Date = new Date()): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  try {
    const base = sharp(bytes, { limitInputPixels: 100_000_000 }).rotate().resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true });
    const { data, info } = await base.toBuffer({ resolveWithObject: true });
    const marca = Buffer.from(svgMarca(info.width, info.height, nome, agora));
    const formatoOriginal = (await sharp(bytes).metadata()).format;
    let img = sharp(data).composite([{ input: marca, top: 0, left: 0 }]);
    let tipo = "image/jpeg";
    if (formatoOriginal === "png") {
      img = img.png();
      tipo = "image/png";
    } else if (formatoOriginal === "webp") {
      img = img.webp({ quality: 82 });
      tipo = "image/webp";
    } else {
      img = img.jpeg({ quality: 84 });
    }
    return { bytes: new Uint8Array(await img.toBuffer()), tipo };
  } catch {
    return null;
  }
}

export async function marcarPdf(bytes: Uint8Array, nome: string, agora: Date = new Date()): Promise<Uint8Array | null> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const fonte = await doc.embedFont(StandardFonts.HelveticaBold);
    const texto = marcaTexto(nome, agora).normalize("NFD").replace(/\p{M}/gu, "");
    for (const pagina of doc.getPages()) {
      const { width, height } = pagina.getSize();
      const tam = Math.max(12, Math.round(Math.min(width, height) / 28));
      for (let y = tam * 2; y < height; y += tam * 5) {
        for (let x = -tam * 2; x < width; x += tam * 16) {
          pagina.drawText(texto, { x, y, size: tam, font: fonte, color: rgb(0.45, 0.45, 0.45), opacity: 0.42, rotate: degrees(24) });
        }
      }
    }
    return await doc.save();
  } catch {
    return null;
  }
}
