/* Token de ativação da parceria: 32 bytes aleatórios no link do e-mail; o banco guarda só o sha256. PURO (servidor). */
import { createHash, randomBytes } from "node:crypto";

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(t: string): string {
  return createHash("sha256").update(String(t ?? "")).digest("hex");
}

/** Formato do token do link (base64url de 32 bytes). Qualquer outra coisa nem chega ao banco. */
export const tokenBemFormado = (t: string | null | undefined): t is string => /^[A-Za-z0-9_-]{43}$/.test(String(t ?? ""));
