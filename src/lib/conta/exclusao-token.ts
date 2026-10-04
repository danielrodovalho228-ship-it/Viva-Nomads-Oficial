import crypto from "node:crypto";

/**
 * Token do link de exclusão de conta (M1).
 *
 * Assinado por HMAC (segredo só do servidor), preso a: id do PEDIDO (uso único,
 * conferido no banco), uid da conta (resolvido por e-mail EXATO, nunca ilike) e
 * e-mail normalizado. Vale 30 minutos.
 */
export const EXCLUSAO_TTL_S = 30 * 60;

export interface ExclusaoToken {
  /** id do pedido em exclusao_conta_pedidos (uso único). */
  j: string;
  /** uid da conta em auth.users. */
  u: string;
  /** e-mail normalizado (trim + minúsculas). */
  e: string;
  /** expiração (epoch s). */
  exp: number;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function assinar(payload: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

/** Hash não reversível (HMAC) para guardar e-mail/IP sem guardar o valor. */
export function hashSeguro(tipo: "email" | "ip", valor: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${tipo}:${valor}`).digest("hex");
}

export function criarTokenExclusao(
  dados: { j: string; u: string; e: string },
  secret: string,
  agoraS = Math.floor(Date.now() / 1000)
): string {
  const corpo: ExclusaoToken = { j: dados.j, u: dados.u, e: normalizarEmail(dados.e), exp: agoraS + EXCLUSAO_TTL_S };
  const payload = b64url(JSON.stringify(corpo));
  return `${payload}.${assinar(payload, secret)}`;
}

/** Confere assinatura e validade; devolve o conteúdo ou null. */
export function lerTokenExclusao(
  token: string,
  secret: string,
  agoraS = Math.floor(Date.now() / 1000)
): ExclusaoToken | null {
  const [payload, sig, ...resto] = (token ?? "").split(".");
  if (!payload || !sig || resto.length) return null;
  const a = b64urlDecode(sig);
  const b = b64urlDecode(assinar(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const t = JSON.parse(b64urlDecode(payload).toString("utf8")) as Partial<ExclusaoToken>;
    if (!t.j || !t.u || !t.e || typeof t.exp !== "number" || t.exp < agoraS) return null;
    return { j: t.j, u: t.u, e: t.e, exp: t.exp };
  } catch {
    return null;
  }
}
