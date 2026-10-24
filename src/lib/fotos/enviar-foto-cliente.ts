/*
  E47-A-CORRECAO — envio de foto do anúncio pelo navegador (prova de nível, pendência de conforto, pedido de ajuda).
  O laboratório da Pista C (#1247, #1251) provou que os ARQUIVOS não derrubam a tela; a tela branca vinha do fetch que
  REJEITA no meio do envio (celular sem sinal, troca de rede) dentro de startTransition — o erro subia ao limite de erro
  do React. Aqui o envio NUNCA lança: toda falha vira { ok: false, erro } para a linha do item mostrar.
  • Antes de enviar: tipo e tamanho (acima de 8 MB, a mesma frase do servidor), sem sair da tela.
  • Rede caiu, 413 ou 5xx: "Não foi possível enviar a foto. Confira a conexão e toque para tentar de novo."
  • Recusa com motivo do servidor (formato, HEIC, limite do dia): a frase do servidor.
  • 413: registra QUAL limite respondeu — o da plataforma (Vercel, ~4,5 MB no corpo da função, antes da rota) ou o da
    rota — para a coordenação saber se é o teto da plataforma.
*/
import { validarArquivoFotoImovel } from "../upload-limits.ts";

export const MSG_FALHA_ENVIO_FOTO = "Não foi possível enviar a foto. Confira a conexão e toque para tentar de novo.";

export type MotivoFalhaFoto = "arquivo" | "rede" | "413_plataforma" | "413_rota" | "servidor" | "recusada";
export type ResultadoEnvioFoto = { ok: true; path: string; url?: string } | { ok: false; erro: string; motivo: MotivoFalhaFoto; status?: number };

type Busca = (url: string, init: { method: string; body: FormData }) => Promise<{ ok: boolean; status: number; headers: { get(n: string): string | null }; json(): Promise<unknown> }>;

/** Envia uma foto para /api/upload/foto. Nunca lança. */
export async function enviarFotoDoAnuncio(arquivo: File, buscar: Busca = fetch as unknown as Busca): Promise<ResultadoEnvioFoto> {
  const erroArquivo = validarArquivoFotoImovel(arquivo);
  if (erroArquivo) return { ok: false, erro: erroArquivo, motivo: "arquivo" };
  const fd = new FormData();
  fd.set("file", arquivo);
  let res: Awaited<ReturnType<Busca>>;
  try {
    res = await buscar("/api/upload/foto", { method: "POST", body: fd });
  } catch {
    return { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo: "rede" };
  }
  let j: { path?: unknown; url?: unknown; error?: unknown } = {};
  try {
    j = ((await res.json()) ?? {}) as typeof j;
  } catch {
    j = {};
  }
  if (res.ok && typeof j.path === "string" && j.path) return { ok: true, path: j.path, url: typeof j.url === "string" ? j.url : undefined };
  if (res.status === 413) {
    // A plataforma responde antes da rota (corpo acima do teto da função), sem o JSON da rota.
    const plataforma = !!res.headers.get("x-vercel-error") || typeof j.error !== "string";
    const motivo: MotivoFalhaFoto = plataforma ? "413_plataforma" : "413_rota";
    console.warn(`[envio-foto] 413 (${motivo})${res.headers.get("x-vercel-error") ? ` ${res.headers.get("x-vercel-error")}` : ""}`);
    return { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo, status: 413 };
  }
  if (res.status >= 500 || (!res.ok && typeof j.error !== "string")) return { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo: "servidor", status: res.status };
  return { ok: false, erro: typeof j.error === "string" && j.error ? j.error : MSG_FALHA_ENVIO_FOTO, motivo: "recusada", status: res.status };
}
