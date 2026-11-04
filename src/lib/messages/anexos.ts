/*
  E445 item 5 (backend): anexos de foto e PDF no chat. PURO (sem rede), usado pelas rotas de envio e de leitura do anexo.
  O tipo vale pelos primeiros bytes (magic bytes), nunca pela extensão nem pelo Content-Type declarado.
*/

export const BUCKET_ANEXOS = "mensagens-anexos";
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type TipoAnexo = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const EXT: Record<TipoAnexo, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Tipo real do arquivo: PDF, JPG, PNG ou WebP. Qualquer outra coisa (SVG, executável, texto) → null. */
export function tipoDoAnexo(bytes: Uint8Array): TipoAnexo | null {
  const c = (i: number, v: number) => bytes.length > i && bytes[i] === v;
  if (c(0, 0x25) && c(1, 0x50) && c(2, 0x44) && c(3, 0x46)) return "application/pdf"; // %PDF
  if (c(0, 0xff) && c(1, 0xd8) && c(2, 0xff)) return "image/jpeg";
  if (c(0, 0x89) && c(1, 0x50) && c(2, 0x4e) && c(3, 0x47) && c(4, 0x0d) && c(5, 0x0a) && c(6, 0x1a) && c(7, 0x0a)) return "image/png";
  // RIFF....WEBP
  if (c(0, 0x52) && c(1, 0x49) && c(2, 0x46) && c(3, 0x46) && c(8, 0x57) && c(9, 0x45) && c(10, 0x42) && c(11, 0x50)) return "image/webp";
  return null;
}

/** Mensagem de erro para quem envia, ou null quando o anexo pode seguir. */
export function erroDoAnexo(tamanho: number, tipo: TipoAnexo | null): string | null {
  if (!(tamanho > 0)) return "O arquivo está vazio.";
  if (tamanho > ANEXO_MAX_BYTES) return "Arquivo grande demais (máx. 10 MB).";
  if (!tipo) return "Envie uma foto (JPG, PNG ou WebP) ou um PDF.";
  return null;
}

/** Caminho no bucket: pasta da conversa + id novo + extensão do tipo real. */
export function caminhoAnexo(conversationId: string, anexoId: string, tipo: TipoAnexo): string {
  return `${conversationId}/${anexoId}.${EXT[tipo]}`;
}

/** Texto da mensagem que carrega o anexo (o nome do arquivo não vai: pode ter contato ou dado pessoal). */
export function corpoDoAnexo(tipo: TipoAnexo): string {
  return tipo === "application/pdf" ? "Anexo: PDF enviado" : "Anexo: foto enviada";
}
