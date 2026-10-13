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

export const MSG_CODIGO_NAO_CONFERE_NOVO =
  "Código não confere. Use o código da entrada nova (QR desta tela) e confira se o horário do celular está automático.";
export const MSG_CODIGO_NAO_CONFERE =
  "Código não confere. Use o código mais recente do app e confira se o horário do celular está automático.";
export const MSG_CONFIRME_CODIGO_SENHA = "Confirme o código do seu autenticador para alterar a senha.";

/** `contexto`: "ativar" = QR recém-lido nesta tela; "entrar" = código de um fator já ativo. */
export function mensagemErroMfa(mensagem: string | undefined, contexto: "ativar" | "entrar" = "entrar"): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("enroll") && m.includes("disabled")) return "A verificação em duas etapas ainda não foi ligada no sistema. Avise o Daniel.";
  if (m.includes("totp") || m.includes("mfa_verification_failed") || m.includes("verification failed")) {
    return contexto === "ativar" ? MSG_CODIGO_NAO_CONFERE_NOVO : MSG_CODIGO_NAO_CONFERE;
  }
  return "Código incorreto ou vencido. Confira o app autenticador e tente de novo.";
}

/** Sessão aal1 com fator verificado (nextLevel aal2): operações sensíveis (senha, e-mail) exigem o código antes. */
export function precisaCodigoParaOperacaoSensivel(currentLevel: string | null | undefined, nextLevel: string | null | undefined): boolean {
  return currentLevel !== "aal2" && nextLevel === "aal2";
}

/** O Supabase recusa updateUser em aal1 com 401 insufficient_aal / "AAL2 session is required". */
export function ehErroAalInsuficiente(mensagem: string | undefined): boolean {
  const m = (mensagem ?? "").toLowerCase();
  return m.includes("insufficient_aal") || m.includes("aal2 session is required");
}

/** Tentativas restantes neste navegador (limite no código; o Supabase também limita). */
export function tentativasRestantes(falhas: number): number {
  return Math.max(0, TENTATIVAS_MAX_2FA - Math.max(0, falhas));
}
