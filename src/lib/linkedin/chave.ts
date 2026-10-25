import { cookies } from "next/headers";
import { LINKEDIN_CONECTAR_ATIVO } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";

/** Cookie que liga o "Conectar LinkedIn" SÓ no laboratório (INTEGRACOES_SIMULADAS; nunca em produção), para o E2E. */
export const COOKIE_LAB_LINKEDIN = "vn_lab_linkedin";

/** A chave LINKEDIN_CONECTAR_ATIVO no servidor; no laboratório o teste liga no próprio navegador (mesmo padrão da vistoria). */
export async function linkedinAtivo(): Promise<boolean> {
  if (LINKEDIN_CONECTAR_ATIVO) return true;
  if (!integracoesSimuladas()) return false;
  try {
    return (await cookies()).get(COOKIE_LAB_LINKEDIN)?.value === "1";
  } catch {
    return false;
  }
}

/**
 * L-31 — a chave para as páginas PÚBLICAS com cache (/imoveis/[id], /proprietario/[id]): NUNCA lê cookie. Ler `cookies()`
 * numa página com `revalidate` faz o Next abortar a renderização no servidor (DYNAMIC_SERVER_USAGE → HTTP 500), mesmo
 * dentro de try/catch. Além disso a página em cache é a mesma para todo visitante: o selo não pode depender do navegador.
 * Vale a chave do servidor; no laboratório, o LinkedIn simulado configurado (o selo só existe para quem conectou pelo
 * fluxo, que exige a chave no próprio navegador).
 */
export function linkedinAtivoPublico(): boolean {
  if (LINKEDIN_CONECTAR_ATIVO) return true;
  return integracoesSimuladas() && !!process.env.LAB_LINKEDIN_URL;
}
