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

/**
 * Parte 2 (API): /api/admin passa pelo mesmo limite. A rota da API não redireciona (é fetch):
 * responde 401 com uma frase simples e o painel manda a pessoa entrar de novo.
 */
export function rotaApiAdmin(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

/**
 * Só ação de verdade (POST/PUT/PATCH/DELETE) conta como atividade. Leitura (GET/HEAD/OPTIONS) pode vir de uma tela
 * aberta que se atualiza sozinha; se contasse, o painel esquecido aberto nunca expiraria.
 */
export function apiAdminRenovaAtividade(metodo: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(metodo.toUpperCase());
}

/** 401 sem cache e sem detalhe interno. O proxy acrescenta a limpeza dos cookies de sessão. */
export function respostaApiAdminOciosa(): Response {
  return Response.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
