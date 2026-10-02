/**
 * Acesso às PÁGINAS INTERNAS DOS SÓCIOS (deck/simulações) — FONTE ÚNICA.
 *
 * Protegidas pelo proxy (middleware). Libera quem satisfaz QUALQUER uma:
 *   (a) sessão logada com papel ADMIN; ou
 *   (b) cookie de sócio válido, obtido na tela de desbloqueio (/acesso-socios)
 *       com o código de acesso.
 *
 * O código vive só em env (`SOCIOS_ACCESS_CODE`) na Vercel — nunca no repo.
 * Trocar a env e redeployar INVALIDA todos os cookies (o token é derivado do
 * código). Camadas complementares: robots.txt esconde do Google, `noindex`
 * reforça, e este gate barra humanos.
 */

/** Lista central das rotas internas — usada pelo gate e pelo matcher do proxy. */
export const INTERNAL_PAGES = [
  "/simulacao",
  "/roi",
  "/modelodenegocio",
  "/socios",
  "/decisao",
  "/tributario",
] as const;

/** Nome do cookie httpOnly assinado do sócio. */
export const SOCIOS_COOKIE = "vn_socios";
/** Rota (pública) da tela de desbloqueio. */
export const SOCIOS_UNLOCK_PATH = "/acesso-socios";
/** Validade do cookie: 30 dias. */
export const SOCIOS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** A rota é uma página interna protegida? (path exato ou subcaminho). */
export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Token do cookie derivado do código (SHA-256 de código + sal). Determinístico:
 * o proxy recomputa e compara. Sem o código não dá para forjar; trocar o código
 * (env) muda o token e revoga todos os cookies. Web Crypto → roda no Edge
 * (proxy) e no Node (server action) igual.
 */
export async function sociosToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`viva-nomads::socios::v1::${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Confere o cookie contra o código atual da env. Fail-closed sem código. */
export async function sociosCookieValido(cookieValue: string | undefined): Promise<boolean> {
  const code = process.env.SOCIOS_ACCESS_CODE;
  if (!code || !cookieValue) return false;
  return cookieValue === (await sociosToken(code));
}

/** Sanitiza o destino pós-desbloqueio: só páginas internas (evita open-redirect). */
export function sanitizeNext(next: string | null | undefined): string {
  const n = (next ?? "").trim();
  return n.startsWith("/") && isInternalPath(n) ? n : "/socios";
}
