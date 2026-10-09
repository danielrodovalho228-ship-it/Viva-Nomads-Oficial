import crypto from "node:crypto";

/**
 * Login Google/Apple dentro do app (ordem 1f65c73d). O app abre o provedor no navegador do sistema e
 * volta por vivanomads://auth/callback?code=...&state=.... O `state` é emitido pelo servidor, vale
 * 5 min e é de USO ÚNICO (o consumo é feito pela rota com consumirLimite). Parte PURA, sem banco.
 * O código PKCE só pode ser trocado no WebView (é lá que está o verificador): a rota nunca troca.
 */

export const VALIDADE_STATE_S = 300;
export const PROVEDORES_APP = ["google", "apple"] as const;
export type ProvedorApp = (typeof PROVEDORES_APP)[number];

/** Link de volta ao app (esquema do app Expo). */
export const RETORNO_APP = "vivanomads://auth/callback";

export function provedorValido(valor: unknown): ProvedorApp | null {
  return typeof valor === "string" && (PROVEDORES_APP as readonly string[]).includes(valor) ? (valor as ProvedorApp) : null;
}

export function segredoLoginApp(env: Record<string, string | undefined> = process.env): string {
  return env.LOGIN_APP_SEGREDO || env.PONTE_APP_SEGREDO || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function assinar(provedor: string, expira: number, nonce: string, segredo: string): string {
  const chave = crypto.createHash("sha256").update(`login-social-app:${segredo}`).digest();
  return crypto.createHmac("sha256", chave).update(`${provedor}\n${expira}\n${nonce}`).digest("hex").slice(0, 40);
}

export interface StateLogin {
  state: string;
  nonce: string;
}

export function emitirStateLogin(provedor: ProvedorApp, agora: Date, segredo: string): StateLogin | null {
  if (!segredo) return null;
  const nonce = crypto.randomBytes(12).toString("hex");
  const expira = Math.floor(agora.getTime() / 1000) + VALIDADE_STATE_S;
  return { state: `${nonce}.${expira}.${assinar(provedor, expira, nonce, segredo)}`, nonce };
}

/** Devolve o nonce (para o consumo único) ou null se formato, prazo ou assinatura não batem. */
export function conferirStateLogin(state: unknown, provedor: ProvedorApp, agora: Date, segredo: string): string | null {
  if (!segredo || typeof state !== "string" || state.length > 100) return null;
  const partes = state.split(".");
  if (partes.length !== 3) return null;
  const [nonce, expiraTxt, assinatura] = partes;
  if (!/^[0-9a-f]{24}$/.test(nonce) || !/^\d{1,12}$/.test(expiraTxt)) return null;
  const expira = Number(expiraTxt);
  if (expira * 1000 < agora.getTime()) return null;
  const esperado = Buffer.from(assinar(provedor, expira, nonce, segredo));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido) ? nonce : null;
}

/** Código PKCE: só caracteres de URL, tamanho razoável (nunca vai a log). */
export function codigoValido(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9._~-]{8,300}$/.test(code);
}

/** URL do deep link de volta ao app, com code e state codificados. */
export function urlRetornoApp(code: string, state: string): string {
  return `${RETORNO_APP}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
}
