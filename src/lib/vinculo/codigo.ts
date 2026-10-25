/**
 * Código de 6 dígitos do vínculo profissional (ordem 9950ef15, item 2). Módulo PURO: gera, faz o hash e confere.
 * O código só existe no e-mail e na memória do servidor; no banco vai o hash (SHA-256 com o id da pessoa como sal).
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const VALIDADE_CODIGO_MIN = 15;
export const MAX_TENTATIVAS = 5;

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashDoCodigo(userId: string, codigo: string): string {
  return createHash("sha256").update(`${userId}:${codigo}`, "utf8").digest("hex");
}

export type ResultadoCodigo = "ok" | "expirado" | "bloqueado" | "errado";

export interface PedidoDeVinculo {
  codigoHash: string;
  expiraEm: string;
  tentativas: number;
}

/** Confere o código digitado. Esgotadas as tentativas ou vencido o prazo, nem compara: a pessoa pede outro código. */
export function conferirCodigo(userId: string, digitado: string, pedido: PedidoDeVinculo, agora: Date): ResultadoCodigo {
  if (pedido.tentativas >= MAX_TENTATIVAS) return "bloqueado";
  if (Date.parse(pedido.expiraEm) <= agora.getTime()) return "expirado";
  const limpo = digitado.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpo)) return "errado";
  const a = Buffer.from(hashDoCodigo(userId, limpo), "hex");
  const b = Buffer.from(pedido.codigoHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "errado";
}
