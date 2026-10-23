import { cookies } from "next/headers";
import { TRIAGEM_VINCULO_ATIVA } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";

/** Cookie que liga a triagem SÓ no laboratório (INTEGRACOES_SIMULADAS; nunca em produção), para o E2E. */
export const COOKIE_LAB_TRIAGEM = "vn_lab_triagem";

/** A chave TRIAGEM_VINCULO_ATIVA no servidor; no laboratório o teste liga no próprio navegador (mesmo padrão da vistoria). */
export async function triagemVinculoAtiva(): Promise<boolean> {
  if (TRIAGEM_VINCULO_ATIVA) return true;
  if (!integracoesSimuladas()) return false;
  try {
    return (await cookies()).get(COOKIE_LAB_TRIAGEM)?.value === "1";
  } catch {
    return false;
  }
}
