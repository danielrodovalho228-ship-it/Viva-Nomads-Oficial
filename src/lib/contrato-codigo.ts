/*
  Assinatura de contrato — código de uso único por e-mail, conferido no SERVIDOR (ordens 810ffe98 / 0a097187).
  Regras PURAS: validade, limite de falhas, reenvio, hash (nunca o código em claro).
*/
import { createHash, randomInt } from "node:crypto";

export const VALIDADE_CODIGO_ASSINATURA_MS = 15 * 60 * 1000;
export const FALHAS_MAX_ASSINATURA = 5;
export const REENVIO_MIN_MS = 60 * 1000;

export const MSG_SEM_CODIGO = "Peça o código por e-mail e digite os 6 números para assinar.";
export const MSG_CODIGO_ERRADO = "Código incorreto.";
export const MSG_CODIGO_EXPIRADO = "O código venceu. Peça um novo.";
export const MSG_CODIGO_BLOQUEADO = "Muitas tentativas erradas. Peça um novo código.";

export interface LinhaCodigo {
  codigo_hash: string;
  expira_em: string;
  falhas: number;
  usado_em: string | null;
  enviado_em: string;
}

export function gerarCodigoAssinatura(sorteio: (max: number) => number = (m) => randomInt(m)): string {
  return String(sorteio(1_000_000)).padStart(6, "0");
}

/** O hash prende o código a esta pessoa e a este contrato: não vale em outro. */
export function hashCodigoAssinatura(userId: string, contratoId: string, codigo: string): string {
  return createHash("sha256").update(`assinar:${contratoId}:${userId}:${codigo.replace(/\s+/g, "")}`).digest("hex");
}

export function codigoComFormato(bruto: string | undefined | null): string | null {
  const limpo = String(bruto ?? "").replace(/\s+/g, "");
  return /^\d{6}$/.test(limpo) ? limpo : null;
}

export type ResultadoCodigo =
  | { ok: true }
  | { ok: false; erro: string; contarFalha: boolean };

/** Decide se o código digitado vale. `contarFalha` = o servidor deve somar 1 às falhas da linha. */
export function conferirCodigo(
  linha: LinhaCodigo | null,
  informado: string | undefined | null,
  userId: string,
  contratoId: string,
  agora: number,
): ResultadoCodigo {
  const limpo = codigoComFormato(informado);
  if (!limpo || !linha) return { ok: false, erro: MSG_SEM_CODIGO, contarFalha: false };
  if (linha.usado_em) return { ok: false, erro: MSG_SEM_CODIGO, contarFalha: false };
  if (Date.parse(linha.expira_em) <= agora) return { ok: false, erro: MSG_CODIGO_EXPIRADO, contarFalha: false };
  if (linha.falhas >= FALHAS_MAX_ASSINATURA) return { ok: false, erro: MSG_CODIGO_BLOQUEADO, contarFalha: false };
  if (hashCodigoAssinatura(userId, contratoId, limpo) !== linha.codigo_hash) {
    return { ok: false, erro: MSG_CODIGO_ERRADO, contarFalha: true };
  }
  return { ok: true };
}

export function podeReenviar(linha: Pick<LinhaCodigo, "enviado_em"> | null, agora: number): boolean {
  return !linha || Date.parse(linha.enviado_em) + REENVIO_MIN_MS <= agora;
}

/**
 * Soma 1 às falhas do código sem perder tentativas simultâneas (comparação e troca): a troca só vale se o
 * contador ainda for o que foi lido; senão lê de novo. `lerFalhas` devolve null se o código não existe ou já foi usado.
 */
export async function incrementarFalhas(
  lerFalhas: () => Promise<number | null>,
  trocar: (de: number) => Promise<boolean>,
  tentativasMax = 5,
): Promise<void> {
  for (let i = 0; i < tentativasMax; i++) {
    const atual = await lerFalhas();
    if (atual === null) return;
    if (await trocar(atual)) return;
  }
}
