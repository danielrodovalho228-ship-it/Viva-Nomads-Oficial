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

/** O caminho é a foto CANÔNICA deste usuário? (nunca o arquivo de outra pessoa) */
export function ehAvatarDoUsuario(path: string | null | undefined, userId: string | null | undefined): boolean {
  return !!path && !!userId && path === avatarPath(userId);
}

// ── CONTA-A: recorte quadrado com arrastar e zoom ──────────────────────────────────────────────────────────────────

/** Zoom do recorte: 1 = o maior quadrado que cabe; até 3x. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
/** Formatos que o navegador decodifica sempre; HEIC só quando o navegador sabe ler (Safari). */
export const FOTO_ACEITA = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const MSG_HEIC = "Envie em JPG ou PNG";
export const ehHeic = (f: { type: string; name?: string }) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name ?? "");

/**
 * O quadrado recortado a partir do zoom e do deslocamento do centro (em fração do lado visível, -0.5…0.5 em cada
 * eixo, já limitado para o quadrado não sair da imagem). zoom=1 e deslocamento 0 = o recorte central de `squareCrop`.
 */
export function recorteComZoom(w: number, h: number, zoom: number, dx: number, dy: number): CropBox {
  const base = Math.min(w, h);
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom || 1));
  const size = Math.max(1, Math.round(base / z));
  const cx = w / 2 + dx * size;
  const cy = h / 2 + dy * size;
  const sx = Math.round(Math.min(Math.max(cx - size / 2, 0), w - size));
  const sy = Math.round(Math.min(Math.max(cy - size / 2, 0), h - size));
  return { sx, sy, size };
}

/** Limita o deslocamento para o quadrado continuar dentro da imagem (devolve o par já ajustado). */
export function limitarDeslocamento(w: number, h: number, zoom: number, dx: number, dy: number): { dx: number; dy: number } {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom || 1));
  const size = Math.min(w, h) / z;
  const maxX = Math.max(0, (w - size) / 2 / size);
  const maxY = Math.max(0, (h - size) / 2 / size);
  return { dx: Math.min(maxX, Math.max(-maxX, dx)), dy: Math.min(maxY, Math.max(-maxY, dy)) };
}
