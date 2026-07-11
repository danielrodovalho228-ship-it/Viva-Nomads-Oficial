/**
 * Limites de upload — FONTE ÚNICA, espelhada no servidor.
 *
 * A validação real (no servidor) mora nos limites do próprio bucket do Supabase
 * (`file_size_limit` + `allowed_mime_types`, migration 0040): mesmo que alguém
 * burle o `accept` do input, o Storage rejeita o arquivo. Estes valores existem
 * para o cliente dar feedback rápido (nome/tamanho/erro) ANTES de subir — mas a
 * autoridade é o bucket. Mantenha os dois em sincronia.
 */
export const DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
// Piso: abaixo disso não é uma matrícula/contrato real (fechou o furo do QA —
// "PDF de 2 KB aceito"). Validado NO SERVIDOR (route /api/upload/documento).
export const DOC_MIN_BYTES = 10 * 1024; // 10 KB
export const DOC_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

/**
 * Tipo REAL do arquivo pelos primeiros bytes (magic bytes) — não confia na
 * extensão nem no Content-Type declarado (ambos falsificáveis). Usado no
 * servidor para barrar um arquivo que se diz PDF mas não é.
 */
export function tipoRealPorMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return "application/pdf"; // "%PDF"
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return "image/png";
  return null;
}

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/** Valida um DOCUMENTO do imóvel (matrícula/contrato). Devolve erro ou null. */
export function validarArquivoDoc(f: { type: string; size: number }): string | null {
  if (!DOC_MIME.includes(f.type as (typeof DOC_MIME)[number]))
    return "Formato inválido. Envie PDF, JPG ou PNG.";
  if (f.size > DOC_MAX_BYTES) return `Arquivo grande demais. Máximo ${mb(DOC_MAX_BYTES)}.`;
  return null;
}

/** Valida uma FOTO do anúncio. Devolve erro ou null. */
export function validarArquivoFotoImovel(f: { type: string; size: number }): string | null {
  if (!f.type.startsWith("image/")) return "Apenas imagens são aceitas.";
  if (f.size > PHOTO_MAX_BYTES) return `Cada foto deve ter no máximo ${mb(PHOTO_MAX_BYTES)}.`;
  return null;
}
