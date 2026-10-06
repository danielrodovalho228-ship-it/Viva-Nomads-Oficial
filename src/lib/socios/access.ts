/**
 * Acesso às PÁGINAS INTERNAS DOS SÓCIOS (deck/simulações) — FONTE ÚNICA.
 *
 * Protegidas pelo proxy (middleware). Libera quem satisfaz QUALQUER uma:
 *   (a) sessão logada com papel ADMIN; ou
 *   (b) cookie de sócio válido, obtido na tela de desbloqueio (/acesso-socios)
 *       com o código de acesso.
 *
 * O código vive só em env (`SOCIOS_ACCESS_CODE`) na Vercel — nunca no repo.
 *
 * INVESTIDOR: código PRÓPRIO (`INVESTIDOR_ACCESS_CODE`), cookie próprio, abre
 * SÓ o /simulacao (em modo leitura). Trocar ou apagar essa env derruba o acesso
 * do investidor sem mexer no código dos sócios.
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

// ── Investidor (código próprio, só /simulacao) ──────────────────────────────
export const INVESTIDOR_COOKIE = "vn_investidor";
/** Únicas páginas que o código do investidor abre. */
export const INVESTIDOR_PAGES = ["/simulacao"] as const;
/** Validade do cookie do investidor: 7 dias. */
export const INVESTIDOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function isInvestidorPath(pathname: string): boolean {
  return INVESTIDOR_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Token do cookie do investidor (sal diferente do dos sócios: um nunca vale pelo outro). */
export async function investidorToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`viva-nomads::investidor::v1::${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Confere o cookie do investidor contra a env atual. Fail-closed sem código. */
export async function investidorCookieValido(cookieValue: string | undefined): Promise<boolean> {
  const code = process.env.INVESTIDOR_ACCESS_CODE;
  if (!code || !cookieValue) return false;
  return cookieValue === (await investidorToken(code));
}

/** Quem pode ver esta página interna: "socio", "investidor" (só /simulacao) ou null. */
export async function acessoInterno(
  pathname: string,
  cookies: { socio?: string; investidor?: string }
): Promise<"socio" | "investidor" | null> {
  if (await sociosCookieValido(cookies.socio)) return "socio";
  if (isInvestidorPath(pathname) && (await investidorCookieValido(cookies.investidor))) return "investidor";
  return null;
}
