/*
  Qualidade e enquadramento das fotos do anúncio (ordem 04e2fe5e, parte 1).
  Funções PURAS (sem DOM/canvas) — a leitura dos pixels fica em processar.ts.
  Os limites são heurísticas simples e conservadoras: o aviso orienta, nunca
  bloqueia o envio.
*/

/** Menor lado/lado maior abaixo do qual a foto é considerada pequena. */
export const LADO_MAIOR_MIN_PX = 1200;
/** Lado maior máximo da foto tratada (mesmo limite do tratamento de EXIF). */
export const LADO_MAIOR_MAX_PX = 1920;
/** Até 40 fotos de uma vez, do rolo da câmera. */
export const MAX_FOTOS_POR_ANUNCIO = 40;
/** Luminância média (0–255) abaixo da qual a foto é escura / acima da qual é estourada. */
export const LUMINANCIA_ESCURA = 70;
export const LUMINANCIA_CLARA = 205;
/** Variância do laplaciano (em cinza 0–255) abaixo da qual a foto está tremida. */
export const NITIDEZ_MIN = 40;
/** Distância de Hamming (0–64) até a qual duas fotos contam como repetidas. */
export const DISTANCIA_REPETIDA = 5;

export type Orientacao = "horizontal" | "vertical" | "quadrada";

export function orientacao(largura: number, altura: number): Orientacao {
  if (largura <= 0 || altura <= 0) return "quadrada";
  const razao = largura / altura;
  if (razao > 1.05) return "horizontal";
  if (razao < 0.95) return "vertical";
  return "quadrada";
}

export interface CaixaCorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Maior retângulo na proporção `largura:altura` que cabe na imagem, centrado
 * (um pouco acima do meio em fotos verticais, onde o assunto costuma ficar
 * mais alto). Serve de capa 4:3 e de card.
 */
export function caixaDeCorte(larguraImg: number, alturaImg: number, razao = 4 / 3): CaixaCorte {
  if (larguraImg <= 0 || alturaImg <= 0 || razao <= 0) return { x: 0, y: 0, largura: 0, altura: 0 };
  let largura = larguraImg;
  let altura = Math.round(largura / razao);
  if (altura > alturaImg) {
    altura = alturaImg;
    largura = Math.round(altura * razao);
  }
  const folgaY = alturaImg - altura;
  const vertical = alturaImg > larguraImg;
  return {
    x: Math.round((larguraImg - largura) / 2),
    y: Math.round(vertical ? folgaY * 0.35 : folgaY / 2),
    largura,
    altura,
  };
}

/** Escala para o lado maior caber em `max` (nunca amplia). */
export function tamanhoFinal(largura: number, altura: number, max = LADO_MAIOR_MAX_PX): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= 0) return { largura: 0, altura: 0 };
  const esc = Math.min(1, max / maior);
  return { largura: Math.max(1, Math.round(largura * esc)), altura: Math.max(1, Math.round(altura * esc)) };
}

export interface Analise {
  largura: number;
  altura: number;
  /** Luminância média 0–255. */
  luminancia: number;
  /** Variância do laplaciano (quanto maior, mais nítida). */
  nitidez: number;
  /** dHash de 64 bits em 16 caracteres hexadecimais. */
  hash: string;
}

/** Cinza (0–255) de pixels RGBA. */
export function paraCinza(rgba: Uint8ClampedArray | Uint8Array, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

export function luminanciaMedia(cinza: ArrayLike<number>): number {
  if (cinza.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < cinza.length; i++) soma += cinza[i];
  return soma / cinza.length;
}

/** Variância do laplaciano 3×3 sobre uma imagem em cinza w×h. */
export function nitidezLaplaciano(cinza: ArrayLike<number>, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let soma = 0;
  let soma2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * cinza[i] - cinza[i - 1] - cinza[i + 1] - cinza[i - w] - cinza[i + w];
      soma += v;
      soma2 += v * v;
      n++;
    }
  }
  const media = soma / n;
  return soma2 / n - media * media;
}

/** dHash: compara pixels vizinhos numa grade 9×8 em cinza → 64 bits. */
export function dHash(cinza9x8: ArrayLike<number>): string {
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += cinza9x8[y * 9 + x] > cinza9x8[y * 9 + x + 1] ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Distância de Hamming entre dois hashes de 16 hex (64 se algum for inválido). */
export function distanciaHash(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return 64;
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export type CodigoAviso = "pequena" | "escura" | "estourada" | "tremida" | "repetida";

export interface AvisoFoto {
  codigo: CodigoAviso;
  mensagem: string;
  dica: string;
}

/** Avisos de qualidade de uma foto. `outrosHashes` = fotos já no anúncio. */
export function avisosDaFoto(a: Analise, outrosHashes: readonly string[] = []): AvisoFoto[] {
  const avisos: AvisoFoto[] = [];
  if (Math.max(a.largura, a.altura) < LADO_MAIOR_MIN_PX) {
    avisos.push({
      codigo: "pequena",
      mensagem: `Foto pequena (${a.largura}×${a.altura} px).`,
      dica: `Envie a foto original do celular, com pelo menos ${LADO_MAIOR_MIN_PX} px no lado maior.`,
    });
  }
  if (a.luminancia < LUMINANCIA_ESCURA) {
    avisos.push({
      codigo: "escura",
      mensagem: "Foto escura.",
      dica: "Abra as cortinas e acenda as luzes do cômodo, de preferência de dia.",
    });
  } else if (a.luminancia > LUMINANCIA_CLARA) {
    avisos.push({
      codigo: "estourada",
      mensagem: "Foto muito clara.",
      dica: "Evite fotografar de frente para a janela; mude de ângulo.",
    });
  }
  if (a.nitidez < NITIDEZ_MIN) {
    avisos.push({
      codigo: "tremida",
      mensagem: "Foto tremida ou sem foco.",
      dica: "Apoie o celular com as duas mãos, toque na tela para focar e tire de novo.",
    });
  }
  if (outrosHashes.some((h) => distanciaHash(a.hash, h) <= DISTANCIA_REPETIDA)) {
    avisos.push({
      codigo: "repetida",
      mensagem: "Parece repetida.",
      dica: "Já há uma foto muito parecida neste anúncio. Troque por outro ângulo do cômodo.",
    });
  }
  return avisos;
}

/**
 * Ajuste leve de exposição (multiplicador de brilho): clareia foto escura e
 * escurece foto estourada, no máximo ±30%. 1 = não mexe.
 */
export function fatorExposicao(luminancia: number): number {
  if (luminancia <= 0) return 1;
  if (luminancia < LUMINANCIA_ESCURA + 20) return Math.min(1.3, 110 / luminancia);
  if (luminancia > LUMINANCIA_CLARA - 20) return Math.max(0.8, 175 / luminancia);
  return 1;
}

/**
 * Fator de brilho que a re-codificação aplica. Com `semExposicao` ("usar original")
 * a foto ainda passa pelo canvas (rotação, tamanho, sem EXIF/GPS), mas sem ajuste.
 */
export function fatorAplicado(luminancia: number, semExposicao = false): number {
  return semExposicao ? 1 : fatorExposicao(luminancia);
}
