/**
 * Sessão do admin expira após 30 min parado (ordem 12a8086d, item 4).
 * O proxy guarda o instante da última navegação em /admin num cookie httpOnly;
 * se o intervalo passar do limite, a sessão é encerrada e o login é pedido de novo.
 * Cookie ausente ou inválido = sessão nova (não bloqueia quem acabou de entrar).
 */
export const COOKIE_ADMIN_ATIVO = "vn_admin_ativo";
export const LIMITE_OCIOSO_ADMIN_MS = 30 * 60 * 1000;

export function sessaoAdminOciosa(
  ultimoAcessoMs: string | number | null | undefined,
  agoraMs: number,
  limiteMs: number = LIMITE_OCIOSO_ADMIN_MS,
  ultimoLoginMs: number = 0,
): boolean {
  if (ultimoAcessoMs === null || ultimoAcessoMs === undefined || ultimoAcessoMs === "") return false;
  const ultimo = Number(ultimoAcessoMs);
  if (!Number.isFinite(ultimo) || ultimo <= 0) return false;
  // Cookie de antes do login atual é de uma sessão anterior: trata como sessão nova.
  if (Number.isFinite(ultimoLoginMs) && ultimo <= ultimoLoginMs) return false;
  return agoraMs - ultimo > limiteMs;
}
