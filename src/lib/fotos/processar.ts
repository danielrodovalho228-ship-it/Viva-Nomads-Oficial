"use client";

/**
 * Tratamento da foto no navegador, ANTES do envio (ordem 04e2fe5e, parte 1):
 *  • corrige a rotação do EXIF (a imagem já sai "em pé") e descarta o EXIF/GPS
 *    ao re-codificar no <canvas>;
 *  • reduz para no máx. 1920 px no lado maior;
 *  • melhoria leve de exposição (±30%) — o dono pode escolher "usar original";
 *  • mede luminância, nitidez e um hash de aparência, para os avisos de
 *    qualidade (escura, tremida, pequena, repetida). As regras ficam em qualidade.ts.
 * Nunca lança: se algo falhar, devolve o original sem análise.
 */
import {
  assinaturaFoto, LADO_ASSINATURA, dHash, fatorAplicado, luminanciaMedia, nitidezLaplaciano, paraCinza, tamanhoFinal, type Analise,
} from "./qualidade";

export interface FotoTratada {
  /** Arquivo a enviar (tratado, ou o original se algo falhou). */
  arquivo: File;
  /** Arquivo original escolhido (para "usar original"). */
  original: File;
  /** null quando a imagem não pôde ser lida. */
  analise: Analise | null;
  /** Houve ajuste de exposição aplicado. */
  melhorada: boolean;
}

const QUALIDADE_JPEG = 0.88;

async function abrir(file: File): Promise<ImageBitmap> {
  // "from-image" aplica a rotação do EXIF (vertical/horizontal certo).
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function lerPixels(bmp: ImageBitmap, w: number, h: number): Uint8ClampedArray | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export interface OpcoesTratamento {
  /** Não ajusta a exposição ("usar original"): mantém rotação/tamanho e descarta EXIF/GPS. */
  semExposicao?: boolean;
}

export async function tratarFoto(file: File, opcoes: OpcoesTratamento = {}): Promise<FotoTratada> {
  const falha: FotoTratada = { arquivo: file, original: file, analise: null, melhorada: false };
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return falha;
  // Nunca rasteriza SVG (nem outro formato fora da lista): devolve o arquivo como veio.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return falha;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await abrir(file);
    const { width: largura, height: altura } = bmp;

    // Análise em tamanho reduzido (rápida, mesmo com 40 fotos).
    const pequeno = tamanhoFinal(largura, altura, 256);
    const px = lerPixels(bmp, pequeno.largura, pequeno.altura);
    const grade = lerPixels(bmp, 9, 8);
    const mini = lerPixels(bmp, LADO_ASSINATURA, LADO_ASSINATURA);
    if (!px || !grade) return falha;
    const cinza = paraCinza(px, pequeno.largura * pequeno.altura);
    const analise: Analise = {
      largura,
      altura,
      luminancia: luminanciaMedia(cinza),
      nitidez: nitidezLaplaciano(cinza, pequeno.largura, pequeno.altura),
      hash: dHash(paraCinza(grade, 72)),
      ...(mini ? { assinatura: assinaturaFoto(paraCinza(mini, LADO_ASSINATURA * LADO_ASSINATURA)) } : {}),
    };

    // Saída: redimensiona + exposição leve + re-codifica (sem EXIF).
    const fim = tamanhoFinal(largura, altura);
    const canvas = document.createElement("canvas");
    canvas.width = fim.largura;
    canvas.height = fim.altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ...falha, analise };
    const fator = fatorAplicado(analise.luminancia, opcoes.semExposicao);
    const melhorada = fator !== 1;
    if (melhorada) ctx.filter = `brightness(${fator.toFixed(2)})`;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, fim.largura, fim.altura);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALIDADE_JPEG));
    if (!blob) return { ...falha, analise };
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { arquivo: new File([blob], nome, { type: "image/jpeg" }), original: file, analise, melhorada };
  } catch {
    return falha;
  } finally {
    bmp?.close();
  }
}
