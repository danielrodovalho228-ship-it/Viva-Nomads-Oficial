/**
 * Foto de perfil — REGRAS PURAS de processamento de imagem (sem DOM/canvas).
 * A remoção de EXIF acontece de graça ao re-codificar via <canvas> (o canvas
 * descarta todos os metadados do arquivo original); estas funções só decidem a
 * GEOMETRIA (recorte quadrado central) e os LIMITES (tamanho/qualidade/tipo),
 * para poderem ser testadas sem navegador.
 */

/** Nome do bucket privado das fotos de perfil (constante compartilhada). */
export const AVATARS_BUCKET = "avatars";
/** Lado máximo do avatar final (quadrado). Acima disso, reduz. */
export const MAX_AVATAR_PX = 512;
/** Qualidade do WebP de saída. */
export const AVATAR_QUALITY = 0.85;
/** Tamanho máximo do arquivo de entrada (8 MB). */
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
/** Tipos de entrada aceitos. */
export const AVATAR_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export interface CropBox {
  sx: number;
  sy: number;
  size: number; // lado do quadrado recortado (em px da origem)
}

/** Recorte quadrado CENTRAL de uma imagem WxH (o maior quadrado que cabe). */
export function squareCrop(w: number, h: number): CropBox {
  const size = Math.max(0, Math.min(w, h));
  return {
    sx: Math.round((w - size) / 2),
    sy: Math.round((h - size) / 2),
    size,
  };
}

/** Lado de saída: o quadrado recortado, limitado a MAX_AVATAR_PX. */
export function outputSize(cropSize: number, max: number = MAX_AVATAR_PX): number {
  if (cropSize <= 0) return 0;
  return Math.min(Math.round(cropSize), max);
}

export type AvatarFileMeta = { type: string; size: number };

/** Valida o arquivo escolhido. Devolve mensagem de erro ou null (ok). */
export function validarArquivoAvatar(file: AvatarFileMeta): string | null {
  const tipoOk = file.type.startsWith("image/");
  if (!tipoOk) return "Escolha um arquivo de imagem (JPG, PNG ou WebP).";
  if (file.size > MAX_AVATAR_BYTES) return "A imagem é muito grande (máximo 8 MB).";
  if (file.size <= 0) return "Arquivo vazio.";
  return null;
}

/** Caminho INTERNO no bucket privado. 1ª pasta = dono (casa com a RLS). */
export function avatarPath(userId: string): string {
  return `${userId}/avatar.webp`;
}
