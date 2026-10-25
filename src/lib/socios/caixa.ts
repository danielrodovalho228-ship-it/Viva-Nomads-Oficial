/**
 * Caixa dos Sócios — regras puras (sem rede, sem banco), testáveis.
 * Sócios (admins) mandam texto, áudio, documento ou print; o servidor transcreve/lê o arquivo e o Moacir responde.
 */

export type TipoCaixa = "texto" | "audio" | "documento" | "imagem";
export type StatusCaixa = "novo" | "em_andamento" | "feito" | "precisa_daniel" | "aguardando_aceite";
export type ExtracaoStatus = "nao_se_aplica" | "pendente" | "ok" | "falhou" | "desligada";

export const BUCKET_CAIXA = "caixa-socios";
/** ADMIN-0: aviso único quando a leitura da Caixa falha (o erro nunca é traduzido como "migração pendente"). */
export const AVISO_CAIXA_ILEGIVEL = "Não foi possível ler a Caixa agora.";
export const LIMITE_BYTES = 25 * 1024 * 1024;
export const LIMITE_TEXTO = 4000;
export const ENVIOS_POR_HORA = 30;

const AUDIO = ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/mpeg", "audio/ogg", "audio/opus", "audio/wav", "audio/x-wav", "audio/webm", "audio/aac"];
const DOC = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];
const IMG = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

/** Extensão → tipo MIME (alguns celulares mandam o arquivo sem type ou com "application/octet-stream"). */
const POR_EXTENSAO: Record<string, string> = {
  m4a: "audio/mp4", mp4: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", oga: "audio/ogg",
  wav: "audio/wav", webm: "audio/webm", aac: "audio/aac",
  pdf: "application/pdf", txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

/** MIME confiável a partir do type informado e do nome do arquivo; null = não aceito. */
export function mimeAceito(type: string | null | undefined, nome: string): string | null {
  const t = (type ?? "").toLowerCase().split(";")[0].trim();
  if ([...AUDIO, ...DOC, ...IMG].includes(t)) return t;
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  return POR_EXTENSAO[ext] ?? null;
}

export function tipoDoMime(mime: string): Exclude<TipoCaixa, "texto"> {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "imagem";
  return "documento";
}

/** Nome seguro para o caminho no bucket: sem barras, acentos ou caracteres estranhos. */
export function nomeSeguro(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-80);
  return base || "arquivo";
}

/** O caminho precisa estar na pasta do próprio autor (`<uid>/...`), sem subir de pasta. */
export function caminhoDoAutor(path: unknown, uid: string): path is string {
  return (
    typeof path === "string" &&
    path.length <= 300 &&
    path.startsWith(`${uid}/`) &&
    !path.includes("..") &&
    /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path)
  );
}

export type EnvioEntrada = { texto?: unknown; path?: unknown; nome?: unknown; mime?: unknown; tamanho?: unknown };
export type EnvioValido = {
  tipo: TipoCaixa;
  texto: string | null;
  path: string | null;
  nome: string | null;
  mime: string | null;
};

/** Valida o envio no servidor (texto e/ou arquivo já enviado ao bucket na pasta do autor). */
export function validarEnvio(e: EnvioEntrada, uid: string): { ok: true; dados: EnvioValido } | { ok: false; erro: string } {
  const texto = typeof e.texto === "string" ? e.texto.trim() : "";
  if (texto.length > LIMITE_TEXTO) return { ok: false, erro: `Texto muito longo (máximo ${LIMITE_TEXTO} caracteres).` };
  const temArquivo = e.path != null && e.path !== "";
  if (!texto && !temArquivo) return { ok: false, erro: "Escreva uma mensagem ou anexe um arquivo." };
  if (!temArquivo) return { ok: true, dados: { tipo: "texto", texto, path: null, nome: null, mime: null } };

  if (!caminhoDoAutor(e.path, uid)) return { ok: false, erro: "Arquivo inválido." };
  const nome = typeof e.nome === "string" ? e.nome.slice(0, 200) : "arquivo";
  const mime = mimeAceito(typeof e.mime === "string" ? e.mime : "", nome);
  if (!mime) return { ok: false, erro: "Tipo de arquivo não aceito. Envie áudio, PDF, Word, Excel ou imagem." };
  const tamanho = Number(e.tamanho);
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > LIMITE_BYTES) return { ok: false, erro: "Arquivo acima de 25 MB." };
  return { ok: true, dados: { tipo: tipoDoMime(mime), texto: texto || null, path: e.path as string, nome, mime } };
}

export const ROTULO_STATUS: Record<StatusCaixa, string> = {
  novo: "Recebido",
  em_andamento: "Em andamento",
  aguardando_aceite: "Aguardando aceite",
  feito: "Feito",
  precisa_daniel: "Aguardando o Daniel",
};

export const ROTULO_EXTRACAO: Record<ExtracaoStatus, string> = {
  nao_se_aplica: "",
  pendente: "Lendo o arquivo…",
  ok: "",
  falhou: "Não foi possível ler o arquivo. Se puder, mande em texto.",
  desligada: "Leitura automática ainda desligada para este tipo de arquivo. Se puder, mande também em texto ou PDF.",
};

/** Imagens que o leitor de IA aceita (HEIC não). */
export const IMAGEM_LEGIVEL = ["image/png", "image/jpeg", "image/webp"];

export const LIMITE_FALTA = 1000;

/** Só o AUTOR do pedido aceita ou reabre, e só enquanto o item está aguardando o aceite. */
export function podeAceitar(item: { status: StatusCaixa; autor_id: string | null }, uid: string): boolean {
  return item.status === "aguardando_aceite" && !!item.autor_id && item.autor_id === uid;
}

/** "Reabrir" exige dizer o que falta (vira o texto que o Moacir lê). */
export function validarReabertura(falta: unknown): { ok: true; falta: string } | { ok: false; erro: string } {
  const t = typeof falta === "string" ? falta.trim() : "";
  if (!t) return { ok: false, erro: "Diga o que falta para reabrir o pedido." };
  if (t.length > LIMITE_FALTA) return { ok: false, erro: `Texto muito longo (máximo ${LIMITE_FALTA} caracteres).` };
  return { ok: true, falta: t };
}
