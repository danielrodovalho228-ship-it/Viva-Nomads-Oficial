/*
  E640 (b) — foto REPETIDA no cadastro (aprovado pelo Daniel em 05/11/2026). PURO.
  Hash perceptual dHash de 64 bits (16 hex), o mesmo que o servidor já grava em fotos_anuncio_hash (foto-reconversao.ts).
  Foto igual ou quase igual à de OUTRO anúncio → alerta ao admin e publicação travada até conferir a matrícula (com o
  E633, é a proteção real contra cadastrar o imóvel em nome de outra pessoa). O dono nunca vê de quem é a outra foto.
*/

/** Até quantos bits de 64 podem diferir para a foto contar como a mesma (recorte, compressão, brilho). O SQL usa o mesmo número. */
export const LIMITE_BITS_FOTO_PARECIDA = 6;

export const ROTULO_FOTO_REPETIDA = "Conferir a matrícula do imóvel";
export const DETALHE_FOTO_REPETIDA = "uma das fotos já aparece em outro anúncio; a equipe confere em até 48 horas";

const HEX = /^[0-9a-f]{16}$/;
const BITS_POR_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Bits diferentes entre dois hashes de 16 hex. Hash inválido → Infinity (nunca "parecido"). */
export function distanciaHamming(a: string, b: string): number {
  if (!HEX.test(a ?? "") || !HEX.test(b ?? "")) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < 16; i++) d += BITS_POR_NIBBLE[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

export const ehFotoParecida = (a: string, b: string): boolean => distanciaHamming(a, b) <= LIMITE_BITS_FOTO_PARECIDA;

/** A conferência da matrícula resolve a trava: conferido ou provável (a leitura bateu com o dono). */
export const matriculaConfereu = (resultado: string | null | undefined): boolean => resultado === "conferido" || resultado === "provavel";
