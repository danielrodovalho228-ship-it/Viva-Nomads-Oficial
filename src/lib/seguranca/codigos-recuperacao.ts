/**
 * Códigos de recuperação do 2FA (ordem 58901f0f) — regras PURAS e testáveis.
 * O Supabase não tem códigos de recuperação nativos: guardamos só o HASH (SHA-256
 * com o id do usuário como sal) numa tabela que só o servidor (service role) lê.
 * Código = 10 letras/números sem ambiguidade (≈ 50 bits), uso único.
 */
import { createHash, randomInt } from "node:crypto";

export const QTD_CODIGOS = 10;
export const AVISO_RESTANTES = 2;
export const FALHAS_MAX_RECUPERACAO = 5;
export const BLOQUEIO_RECUPERACAO_MS = 15 * 60 * 1000;
export const VALIDADE_CODIGO_EMAIL_MS = 15 * 60 * 1000;
export const JANELA_SENHA_RECENTE_MS = 5 * 60 * 1000;

// Sem 0/O/1/I/L para ler e digitar sem erro.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "ABCDE-FGHJK" → "ABCDEFGHJK"; tira espaços/traços e põe em maiúsculas. */
export function normalizarCodigo(bruto: string): string {
  return bruto.toUpperCase().replace(/[\s-]+/g, "");
}

export function codigoRecuperacaoValido(bruto: string): string | null {
  const n = normalizarCodigo(bruto);
  return new RegExp(`^[${ALFABETO}]{10}$`).test(n) ? n : null;
}

export function formatarCodigo(normalizado: string): string {
  return `${normalizado.slice(0, 5)}-${normalizado.slice(5)}`;
}

export function gerarCodigos(qtd = QTD_CODIGOS, sorteio: (max: number) => number = (m) => randomInt(m)): string[] {
  const vistos = new Set<string>();
  while (vistos.size < qtd) {
    let c = "";
    for (let i = 0; i < 10; i++) c += ALFABETO[sorteio(ALFABETO.length)];
    vistos.add(c);
  }
  return [...vistos].map(formatarCodigo);
}

export function hashCodigo(userId: string, codigo: string): string {
  return createHash("sha256").update(`${userId}:${normalizarCodigo(codigo)}`).digest("hex");
}

/** Código de 6 dígitos enviado por e-mail para refazer o 2FA. */
export function gerarCodigoEmail(sorteio: (max: number) => number = (m) => randomInt(m)): string {
  return String(sorteio(1_000_000)).padStart(6, "0");
}

export function hashCodigoEmail(userId: string, codigo: string): string {
  return createHash("sha256").update(`refazer:${userId}:${codigo.replace(/\s+/g, "")}`).digest("hex");
}

/** Avisa quando restam poucos códigos (2 ou menos, inclusive zero). */
export function avisarPoucosCodigos(restantes: number): boolean {
  return restantes <= AVISO_RESTANTES;
}

export interface EstadoLimite {
  falhas: number;
  bloqueadoAte: number | null;
}

export function bloqueado(e: EstadoLimite, agora: number): boolean {
  return e.bloqueadoAte !== null && e.bloqueadoAte > agora;
}

/** Depois de uma falha: soma e, na 5ª, bloqueia por 15 min (zera a contagem). */
export function aposFalha(e: EstadoLimite, agora: number): EstadoLimite {
  const base = e.bloqueadoAte !== null && e.bloqueadoAte <= agora ? 0 : e.falhas;
  const falhas = base + 1;
  if (falhas >= FALHAS_MAX_RECUPERACAO) return { falhas: 0, bloqueadoAte: agora + BLOQUEIO_RECUPERACAO_MS };
  return { falhas, bloqueadoAte: null };
}

/** A pessoa digitou a senha há pouco? (last_sign_in_at do Supabase) */
export function senhaRecente(lastSignInAt: string | null | undefined, agora: number): boolean {
  const t = Date.parse(lastSignInAt ?? "");
  return Number.isFinite(t) && agora - t >= -60_000 && agora - t <= JANELA_SENHA_RECENTE_MS;
}

export const MSG_CODIGO_RECUPERACAO_INVALIDO = "Código de recuperação inválido ou já usado.";
export const MSG_RECUPERACAO_BLOQUEADA = "Muitas tentativas. Espere 15 minutos e tente de novo.";
export const MSG_ERRO_RELOGIO =
  "Código não confere — confira se o relógio do celular está no automático e se está usando a entrada mais nova do app.";
