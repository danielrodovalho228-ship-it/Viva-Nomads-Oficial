import { cookies } from "next/headers";
import { VISTORIA_ATIVA } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";

/** Cookie que liga a avaliação SÓ no laboratório (INTEGRACOES_SIMULADAS; nunca em produção), para o E2E. */
export const COOKIE_LAB_VISTORIA = "vn_lab_vistoria";

/**
 * A chave VISTORIA_ATIVA vale no servidor. No laboratório o teste liga só no próprio navegador (cookie), sem mudar o
 * resto da rodada; em produção o cookie não vale nada.
 */
export async function vistoriaAtiva(): Promise<boolean> {
  if (VISTORIA_ATIVA) return true;
  if (!integracoesSimuladas()) return false;
  try {
    return (await cookies()).get(COOKIE_LAB_VISTORIA)?.value === "1";
  } catch {
    return false;
  }
}
