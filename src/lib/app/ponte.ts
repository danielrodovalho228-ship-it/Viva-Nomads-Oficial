import crypto from "node:crypto";

/**
 * Ponte app → navegador (ordem bc09134e, item 3): quando o app abre o checkout numa janela por cima,
 * a pessoa não precisa entrar de novo. O servidor emite um token de USO ÚNICO (60 s), amarrado ao
 * usuário e ao destino; só caminhos internos. Esta parte é PURA (sem banco): o "uma vez só" é
 * consumido pela rota com consumirLimite (src/lib/limites.ts). Nunca registrar o token em log.
 */

export const VALIDADE_PONTE_S = 60;

/** Destinos que a ponte aceita: só o checkout/assinatura. Qualquer outro caminho é recusado. */
const DESTINOS_PERMITIDOS = ["/dashboard/assinatura"];

/** Caminho interno seguro ("/..." sem "//", sem esquema, sem barra invertida), ou null. */
export function destinoPonteValido(destino: unknown): string | null {
  if (typeof destino !== "string" || destino.length === 0 || destino.length > 200) return null;
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(destino)) return null;
  const caminho = destino.split(/[?#]/)[0];
  const ok = DESTINOS_PERMITIDOS.some((d) => caminho === d || caminho.startsWith(`${d}/`));
  return ok ? destino : null;
}

/** Segredo da ponte: variável própria (PONTE_APP_SEGREDO); sem ela, cai na service role (nunca vazio). */
export function segredoPonte(env: Record<string, string | undefined> = process.env): string {
  return env.PONTE_APP_SEGREDO || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function chave(segredo: string): Buffer {
  return crypto.createHash("sha256").update(`ponte-app:${segredo}`).digest();
}

function assinar(usuario: string, destino: string, expira: number, nonce: string, segredo: string): string {
  return crypto
    .createHmac("sha256", chave(segredo))
    .update(`${usuario}\n${destino}\n${expira}\n${nonce}`)
    .digest("hex")
    .slice(0, 40);
}

export interface TokenPonte {
  /** Valor para ir na URL (n.e.s). */
  token: string;
  /** Identificador de uso único (vai para consumirLimite). */
  nonce: string;
  expira: number;
}

/** Emite o token: nonce aleatório + expiração + assinatura que cobre usuário e destino. */
export function emitirTokenPonte(usuario: string, destino: string, agora: Date, segredo: string): TokenPonte | null {
  const d = destinoPonteValido(destino);
  if (!d || !usuario || !segredo) return null;
  const nonce = crypto.randomBytes(12).toString("hex");
  const expira = Math.floor(agora.getTime() / 1000) + VALIDADE_PONTE_S;
  return { token: `${nonce}.${expira}.${assinar(usuario, d, expira, nonce, segredo)}`, nonce, expira };
}

/**
 * Confere formato, prazo e assinatura para ESTE usuário e ESTE destino. Devolve o nonce (para o
 * consumo único) ou null. Token de outro usuário ou de outro destino é recusado.
 */
export function conferirTokenPonte(token: string, usuario: string, destino: string, agora: Date, segredo: string): string | null {
  const d = destinoPonteValido(destino);
  if (!d || !usuario || !segredo || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [nonce, expiraTxt, assinatura] = partes;
  if (!/^[0-9a-f]{24}$/.test(nonce) || !/^\d{1,12}$/.test(expiraTxt)) return null;
  const expira = Number(expiraTxt);
  if (expira * 1000 < agora.getTime()) return null;
  const esperado = Buffer.from(assinar(usuario, d, expira, nonce, segredo));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido) ? nonce : null;
}
