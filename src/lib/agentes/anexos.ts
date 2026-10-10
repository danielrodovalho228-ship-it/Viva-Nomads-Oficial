/**
 * Central v2 — PR A, parte 1: regras dos anexos do chat dos agentes (ordem 34f2b39d).
 * Lógica pura: tipo, tamanho e nome do arquivo. O arquivo vai para o bucket PRIVADO
 * "central-anexos" (só admin) e é lido por URL assinada de 10 min. Anexo é DADO, nunca instrução.
 */
export const TAMANHO_MAXIMO_ANEXO = 20 * 1024 * 1024; // 20 MB
export const VALIDADE_URL_ANEXO_SEGUNDOS = 10 * 60;
export const BUCKET_ANEXOS = "central-anexos";

export type CategoriaAnexo = "imagem" | "pdf" | "planilha" | "documento" | "audio";

const TIPOS: Record<string, { categoria: CategoriaAnexo; extensao: string }> = {
  "image/jpeg": { categoria: "imagem", extensao: "jpg" },
  "image/png": { categoria: "imagem", extensao: "png" },
  "image/webp": { categoria: "imagem", extensao: "webp" },
  "application/pdf": { categoria: "pdf", extensao: "pdf" },
  "text/csv": { categoria: "planilha", extensao: "csv" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { categoria: "planilha", extensao: "xlsx" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { categoria: "documento", extensao: "docx" },
  "audio/mpeg": { categoria: "audio", extensao: "mp3" },
  "audio/mp4": { categoria: "audio", extensao: "m4a" },
  "audio/wav": { categoria: "audio", extensao: "wav" },
  "audio/webm": { categoria: "audio", extensao: "webm" },
};

export const MIME_ANEXOS_PERMITIDOS = Object.keys(TIPOS);

export type ResultadoAnexo =
  | { ok: true; categoria: CategoriaAnexo; extensao: string }
  | { ok: false; erro: string };

/** Confere tipo e tamanho declarados. Nunca confia no nome do arquivo para decidir o tipo. */
export function validarAnexo(mime: string, bytes: number): ResultadoAnexo {
  const tipo = TIPOS[mime.toLowerCase().split(";")[0].trim()];
  if (!tipo) return { ok: false, erro: "Tipo de arquivo não aceito. Use imagem, PDF, planilha, documento ou áudio." };
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes > TAMANHO_MAXIMO_ANEXO) return { ok: false, erro: "Arquivo acima de 20 MB." };
  return { ok: true, ...tipo };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Caminho no bucket: <admin>/<anexo>.<ext>. Só ids e extensão fixa: o nome do cliente nunca entra no caminho. */
export function caminhoAnexo(adminId: string, anexoId: string, extensao: string): string | null {
  if (!UUID.test(adminId) || !UUID.test(anexoId)) return null;
  if (!/^[a-z0-9]{2,5}$/.test(extensao)) return null;
  return `${adminId}/${anexoId}.${extensao}`;
}

/** Nome para exibir: sem pasta, sem caracteres de controle, até 80 caracteres. */
export function nomeExibicao(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base.replace(/[\u0000-\u001f\u007f<>"]/g, "").trim();
  return (limpo || "arquivo").slice(0, 80);
}

/** O admin só abre anexo do próprio caminho (primeira pasta = id dele). */
export function adminPodeAbrir(adminId: string, caminho: string): boolean {
  return UUID.test(adminId) && caminho.startsWith(`${adminId}/`) && !caminho.includes("..");
}
