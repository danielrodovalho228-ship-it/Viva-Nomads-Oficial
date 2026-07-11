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
export const DOC_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

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
