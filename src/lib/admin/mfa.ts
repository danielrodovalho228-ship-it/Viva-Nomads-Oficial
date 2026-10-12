/**
 * Verificação em duas etapas (TOTP) obrigatória para ADMIN (ordem f7817f00).
 * Regras PURAS, usadas pelo proxy, pelo layout de /admin e pelas server actions
 * (ehAdmin). Nada de segredo TOTP aqui: o Supabase Auth guarda e valida.
 */
import { safeInternalPath } from "../safe-redirect.ts";

export const CAMINHO_ATIVAR_2FA = "/dashboard/conta/seguranca";
export const CAMINHO_VERIFICAR_2FA = "/auth/verificar-codigo";
export const TENTATIVAS_MAX_2FA = 5;

export type PortaoMfa = "liberar" | "ativar" | "verificar";

/**
 * currentLevel/nextLevel vêm de supabase.auth.mfa.getAuthenticatorAssuranceLevel().
 * aal2 → libera. Tem fator verificado (nextLevel aal2) mas a sessão é aal1 → pede o código.
 * Sem fator → obriga a ativar. Na dúvida (nível desconhecido) NÃO libera.
 */
export function decidirPortaoMfa(currentLevel: string | null | undefined, nextLevel: string | null | undefined): PortaoMfa {
  if (currentLevel === "aal2") return "liberar";
  if (nextLevel === "aal2") return "verificar";
  return "ativar";
}

/** Válvula de emergência (só via variável de ambiente): ADMIN_2FA_OBRIGATORIA=off. */
export function mfaAdminObrigatoria(valorEnv: string | undefined = process.env.ADMIN_2FA_OBRIGATORIA): boolean {
  return valorEnv !== "off";
}

/** Destino da tela de código, guardando o destino COMPLETO (pathname+search). */
export function urlVerificarCodigo(destino: string): string {
  return `${CAMINHO_VERIFICAR_2FA}?redirect=${encodeURIComponent(safeInternalPath(destino, "/admin"))}`;
}

export function urlAtivar2fa(destino: string): string {
  return `${CAMINHO_ATIVAR_2FA}?obrigatorio=admin&redirect=${encodeURIComponent(safeInternalPath(destino, "/admin"))}`;
}

/** Código do app autenticador: exatamente 6 dígitos (espaços são ignorados). */
export function codigoTotpValido(bruto: string): string | null {
  const limpo = bruto.replace(/\s+/g, "");
  return /^\d{6}$/.test(limpo) ? limpo : null;
}

export function mensagemErroMfa(mensagem: string | undefined): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("enroll") && m.includes("disabled")) return "A verificação em duas etapas ainda não foi ligada no sistema. Avise o Daniel.";
  return "Código incorreto ou vencido. Confira o app autenticador e tente de novo.";
}

/** Tentativas restantes neste navegador (limite no código; o Supabase também limita). */
export function tentativasRestantes(falhas: number): number {
  return Math.max(0, TENTATIVAS_MAX_2FA - Math.max(0, falhas));
}
