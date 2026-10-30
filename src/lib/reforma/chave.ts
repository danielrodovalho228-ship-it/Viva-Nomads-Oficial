import { cookies } from "next/headers";
import { ENQUADRAMENTO_REFORMA } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";

/** Cookie que liga o E255 SÓ no laboratório (INTEGRACOES_SIMULADAS; nunca em produção), para o E2E. */
export const COOKIE_LAB_REFORMA = "vn_lab_reforma";

/** A chave ENQUADRAMENTO_REFORMA no servidor; no laboratório o teste liga no próprio navegador (padrão da triagem). */
export async function enquadramentoReformaAtivo(): Promise<boolean> {
  if (ENQUADRAMENTO_REFORMA) return true;
  if (!integracoesSimuladas()) return false;
  try {
    return (await cookies()).get(COOKIE_LAB_REFORMA)?.value === "1";
  } catch {
    return false;
  }
}
