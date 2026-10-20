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
/**
 * Foto repetida (Q6, prompt 10): só QUASE IDÊNTICA — a mesma foto recortada, comprimida ou reenviada. Dois ângulos
 * do mesmo cômodo NÃO são repetidos. Compara a "assinatura" (miniatura 16×16 em cinza, normalizada por média e
 * desvio): distância média ≤ LIMIAR_REPETIDA. Nos testes, recorte de 10% + compressão fica em ~0,18 e outro ângulo
 * do mesmo quarto em ≥ 0,30.
 */
export const LIMIAR_REPETIDA = 0.22;
/** Fotos antigas (sem assinatura): dHash de 64 bits, só quase igual. */
export const DISTANCIA_REPETIDA = 3;
/** Lado da miniatura da assinatura. */
export const LADO_ASSINATURA = 16;

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
  /** Miniatura 16×16 normalizada (512 hex) — detecta foto quase idêntica. */
  assinatura?: string;
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

/** Reduz uma imagem em cinza (W×H) para w×h pela média de cada área. PURO. */
export function reduzirCinza(cinza: ArrayLike<number>, W: number, H: number, w: number, h: number): Float32Array {
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * W) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / w));
      const y0 = Math.floor((y * H) / h);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / h));
      let soma = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) (soma += cinza[yy * W + xx]), n++;
      o[y * w + x] = n ? soma / n : 0;
    }
  }
  return o;
}

/** Assinatura da foto: miniatura em cinza normalizada (média 0, desvio 1), limitada a ±4 e guardada em 1 byte. */
export function assinaturaFoto(miniatura: ArrayLike<number>): string {
  const n = miniatura.length;
  let media = 0;
  for (let i = 0; i < n; i++) media += miniatura[i];
  media /= n || 1;
  let v = 0;
  for (let i = 0; i < n; i++) v += (miniatura[i] - media) ** 2;
  const desvio = Math.sqrt(v / (n || 1)) || 1;
  let hex = "";
  for (let i = 0; i < n; i++) {
    const z = Math.max(-4, Math.min(4, (miniatura[i] - media) / desvio));
    hex += Math.round(((z + 4) / 8) * 255).toString(16).padStart(2, "0");
  }
  return hex;
}

/** Distância média (em desvios) entre duas assinaturas; Infinity se alguma for inválida. */
export function distanciaAssinatura(a: string | undefined, b: string | undefined): number {
  if (!a || !b || a.length !== b.length || a.length % 2 || !/^[0-9a-f]+$/.test(a + b)) return Infinity;
  let d = 0;
  const n = a.length / 2;
  for (let i = 0; i < n; i++) d += Math.abs(parseInt(a.slice(2 * i, 2 * i + 2), 16) - parseInt(b.slice(2 * i, 2 * i + 2), 16));
  return (d / n) * (8 / 255);
}

/** As duas fotos são a mesma (quase idênticas)? Usa a assinatura; sem ela, o dHash bem estrito. */
export function fotosRepetidas(a: { hash?: string; assinatura?: string }, b: { hash?: string; assinatura?: string }): boolean {
  if (a.assinatura && b.assinatura) return distanciaAssinatura(a.assinatura, b.assinatura) <= LIMIAR_REPETIDA;
  return !!a.hash && !!b.hash && distanciaHash(a.hash, b.hash) <= DISTANCIA_REPETIDA;
}

export type CodigoAviso = "pequena" | "escura" | "estourada" | "tremida" | "repetida";

export interface AvisoFoto {
  codigo: CodigoAviso;
  mensagem: string;
  dica: string;
  /** Na "repetida": id da foto parecida (o card mostra a miniatura dela). */
  parecidaCom?: string;
}

export type FotoComparavel = string | { id?: string; hash?: string; assinatura?: string };

/** Avisos de qualidade de uma foto. `outras` = fotos já no anúncio (hash antigo ou {id, hash, assinatura}). */
export function avisosDaFoto(a: Analise, outras: readonly FotoComparavel[] = []): AvisoFoto[] {
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
  const parecida = outras
    .map((o) => (typeof o === "string" ? { hash: o } : o))
    .find((o) => fotosRepetidas(a, o));
  if (parecida) {
    avisos.push({
      codigo: "repetida",
      mensagem: "Parece repetida.",
      dica: "Esta foto é quase igual a outra do anúncio. Troque por outro ângulo do cômodo.",
      ...(parecida.id ? { parecidaCom: parecida.id } : {}),
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
