/**
 * Central v2 — PR A, parte 2 (ordem 34f2b39d): serviço de anexos do chat, sem Supabase direto
 * para poder ser testado. A rota injeta as dependências reais. Só admin; anexo é DADO, nunca instrução.
 */
import { adminPodeAbrir, caminhoAnexo, nomeExibicao, validarAnexo, VALIDADE_URL_ANEXO_SEGUNDOS } from "./anexos.ts";

export type DepsAnexos = {
  adminId(): Promise<string | null>;
  novoId(): string;
  guardar(caminho: string, conteudo: Uint8Array, mime: string): Promise<boolean>;
  assinar(caminho: string, segundos: number): Promise<string | null>;
};

export type Resposta = { status: number; body: Record<string, unknown> };

export async function enviarAnexo(
  deps: DepsAnexos,
  arq: { nome: string; mime: string; bytes: number; conteudo: Uint8Array },
): Promise<Resposta> {
  const admin = await deps.adminId();
  if (!admin) return { status: 403, body: { erro: "Só admin." } };
  const v = validarAnexo(arq.mime, arq.bytes);
  if (!v.ok) return { status: 400, body: { erro: v.erro } };
  const caminho = caminhoAnexo(admin, deps.novoId(), v.extensao);
  if (!caminho) return { status: 400, body: { erro: "Arquivo inválido." } };
  const ok = await deps.guardar(caminho, arq.conteudo, arq.mime.split(";")[0].trim().toLowerCase());
  if (!ok) return { status: 500, body: { erro: "Não consegui guardar o arquivo. Tente de novo." } };
  return { status: 200, body: { caminho, categoria: v.categoria, nome: nomeExibicao(arq.nome) } };
}

export async function abrirAnexo(deps: DepsAnexos, caminho: string): Promise<Resposta> {
  const admin = await deps.adminId();
  if (!admin) return { status: 403, body: { erro: "Só admin." } };
  if (!adminPodeAbrir(admin, caminho)) return { status: 404, body: { erro: "Anexo não encontrado." } };
  const url = await deps.assinar(caminho, VALIDADE_URL_ANEXO_SEGUNDOS);
  if (!url) return { status: 404, body: { erro: "Anexo não encontrado." } };
  return { status: 200, body: { url, expiraEmSegundos: VALIDADE_URL_ANEXO_SEGUNDOS } };
}
