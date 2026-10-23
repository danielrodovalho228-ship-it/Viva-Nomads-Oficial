/**
 * Vídeo curto do anúncio (ordem 8681ae95, parte 1): limites e validação.
 *
 * Fonte única dos limites, espelhada no bucket `anuncio-videos` (migração 0211).
 * O navegador só dá retorno rápido; a autoridade é o servidor, que confere o tipo
 * REAL pelos primeiros bytes, o tamanho e a duração lida do próprio arquivo
 * (caixa mvhd do MP4/MOV) — nunca a extensão nem o Content-Type declarados.
 */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const VIDEO_MAX_SEGUNDOS = 60;
export const VIDEO_MIME = ["video/mp4", "video/quicktime"] as const;
export type VideoMime = (typeof VIDEO_MIME)[number];

const MSG_FORMATO = "Envie o vídeo em MP4 ou MOV.";
const MSG_TAMANHO = "O vídeo deve ter no máximo 50 MB.";
const MSG_DURACAO = `O vídeo deve ter no máximo ${VIDEO_MAX_SEGUNDOS} segundos.`;
const MSG_SEM_DURACAO = "Não conseguimos ler a duração do vídeo. Grave de novo pelo celular ou exporte em MP4.";

/** Retorno rápido no navegador (declarado, não confiável). Devolve a mensagem de erro ou null. */
export function validarVideoNoNavegador(f: { type: string; size: number }): string | null {
  if (!VIDEO_MIME.includes(f.type as VideoMime)) return MSG_FORMATO;
  if (f.size <= 0) return "O arquivo está vazio.";
  if (f.size > VIDEO_MAX_BYTES) return MSG_TAMANHO;
  return null;
}

const texto = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** Tipo real pela caixa `ftyp` (MP4/MOV começam por ela). Qualquer outra coisa devolve null. */
export function tipoRealVideoPorMagicBytes(bytes: Uint8Array): VideoMime | null {
  if (bytes.length < 12 || texto(bytes, 4, 4) !== "ftyp") return null;
  return texto(bytes, 8, 4) === "qt  " ? "video/quicktime" : "video/mp4";
}

/** Procura uma caixa filha de `tipo` entre [ini, fim). Devolve [início do corpo, fim] ou null. */
function acharCaixa(b: Uint8Array, ini: number, fim: number, tipo: string): [number, number] | null {
  let pos = ini;
  for (let i = 0; i < 4096 && pos + 8 <= fim; i++) {
    let tam = u32(b, pos);
    let cab = 8;
    if (tam === 1) {
      if (pos + 16 > fim || u32(b, pos + 8) !== 0) return null; // tamanho de 64 bits acima de 4 GB: não é nosso caso
      tam = u32(b, pos + 12);
      cab = 16;
    } else if (tam === 0) {
      tam = fim - pos;
    }
    if (tam < cab || pos + tam > fim) return null; // caixa truncada ou corrompida
    if (texto(b, pos + 4, 4) === tipo) return [pos + cab, pos + tam];
    pos += tam;
  }
  return null;
}

/** Duração em segundos lida de moov/mvhd (versão 0 ou 1). null se não der para ler com segurança. */
export function duracaoDoVideoSegundos(bytes: Uint8Array): number | null {
  const moov = acharCaixa(bytes, 0, bytes.length, "moov");
  if (!moov) return null;
  const mvhd = acharCaixa(bytes, moov[0], moov[1], "mvhd");
  if (!mvhd) return null;
  const [c, fim] = mvhd;
  const versao = bytes[c];
  const iEscala = c + (versao === 1 ? 20 : 12);
  if (versao !== 0 && versao !== 1) return null;
  if (iEscala + (versao === 1 ? 12 : 8) > fim) return null;
  const escala = u32(bytes, iEscala);
  const duracao = versao === 1 ? u32(bytes, iEscala + 4) * 2 ** 32 + u32(bytes, iEscala + 8) : u32(bytes, iEscala + 4);
  if (escala === 0) return null;
  return Math.round(duracao / escala);
}

export type ResultadoVideo = { ok: true; tipo: VideoMime; segundos: number } | { ok: false; erro: string };

/** Validação de verdade, no servidor: tamanho, tipo real e duração (até 60 s). */
export function validarVideoNoServidor(bytes: Uint8Array, tamanho: number = bytes.length): ResultadoVideo {
  if (tamanho > VIDEO_MAX_BYTES) return { ok: false, erro: MSG_TAMANHO };
  const tipo = tipoRealVideoPorMagicBytes(bytes);
  if (!tipo) return { ok: false, erro: MSG_FORMATO };
  const segundos = duracaoDoVideoSegundos(bytes);
  if (segundos === null) return { ok: false, erro: MSG_SEM_DURACAO };
  if (segundos > VIDEO_MAX_SEGUNDOS) return { ok: false, erro: MSG_DURACAO };
  return { ok: true, tipo, segundos };
}

/** Caminho aceito para gravar no anúncio: "<uid>/<arquivo>" na pasta do próprio dono (espelha a CHECK da migração 0211). */
export function caminhoVideoDoDono(path: unknown, ownerId: string): path is string {
  if (typeof path !== "string" || path.length > 200 || path.includes("..")) return false;
  const pasta = `${ownerId}/`;
  return path.startsWith(pasta) && path.length > pasta.length && !path.slice(pasta.length).includes("/");
}

/** Nome do arquivo no bucket: sorteado, com a extensão do tipo real (nunca o nome que a pessoa deu). */
export function caminhoNovoVideo(ownerId: string, tipo: VideoMime, id: string = crypto.randomUUID()): string {
  return `${ownerId}/${id}.${tipo === "video/quicktime" ? "mov" : "mp4"}`;
}

/** Coluna a gravar: só caminho da pasta do próprio dono; "" limpa; ausente ou inválido não mexe (nunca apaga por engano). */
export function colunaVideoArquivo(v: string | undefined, ownerId: string): { video_arquivo?: string | null } {
  if (v === "") return { video_arquivo: null };
  return caminhoVideoDoDono(v, ownerId) ? { video_arquivo: v } : {};
}
