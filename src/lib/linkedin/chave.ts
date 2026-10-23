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
