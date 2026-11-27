import "server-only";
import { createHmac } from "node:crypto";
import { assinarLink, linkProtegidoPath } from "./visualizacao";

/**
 * E640 (c) — a chave de assinatura deriva de um segredo que o servidor já tem (a chave de serviço do Supabase, que nunca sai
 * do servidor): nenhuma variável nova na Vercel. Sem ela, o link simplesmente não é gerado (a foto não aparece), nunca a URL crua.
 */
export function segredoProtecao(): string | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return base ? createHmac("sha256", base).update("protegido:conferencia:v1").digest("hex") : null;
}

/** Caminho da foto/laudo da conferência → o link protegido de quem está logado (expira em minutos). null se não der. */
export function linkProtegidoDe(caminho: string | null | undefined, uid: string | null | undefined): string | null {
  const segredo = segredoProtecao();
  if (!caminho || !uid || !segredo) return null;
  try {
    return linkProtegidoPath(assinarLink({ caminho, uid }, segredo));
  } catch {
    return null;
  }
}
