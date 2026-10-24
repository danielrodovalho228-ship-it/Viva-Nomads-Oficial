import "server-only";
import { cookies } from "next/headers";
import { DETECCAO_FOTOS_ATIVO } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";
import { deteccaoLigada } from "./deteccao";

/** Cookie que liga a detecção SÓ no laboratório (INTEGRACOES_SIMULADAS; em produção não vale nada), para o E2E. */
export const COOKIE_LAB_DETECCAO = "vn_lab_deteccao";

/** A chave DETECCAO_FOTOS_ATIVO vale no servidor; com ela desligada nenhuma foto sai para o modelo. */
export async function deteccaoAtiva(): Promise<boolean> {
  if (DETECCAO_FOTOS_ATIVO) return true;
  const simulado = integracoesSimuladas();
  if (!simulado) return false;
  try {
    return deteccaoLigada({ chave: false, simulado, cookieLab: (await cookies()).get(COOKIE_LAB_DETECCAO)?.value === "1" });
  } catch {
    return false;
  }
}
