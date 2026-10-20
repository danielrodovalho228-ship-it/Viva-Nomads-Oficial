/*
  Remetente ÚNICO dos e-mails de cliente (rota rápida "e-mails profissionais", item 1) — PURO.
  O mesmo nome e endereço que o Supabase usa nos e-mails de conta: quem responde cai num endereço que alguém lê.
  Exceção: e-mails INTERNOS (avisos do Moacir ao Daniel, leads de Plano Gestor e B2B, alertas da equipe), que
  continuam com o remetente de sistema.
*/
import { SUPORTE_EMAIL } from "../site.ts";

export const REMETENTE_EMAIL = SUPORTE_EMAIL;
export const REMETENTE_NOME = "Viva Nomads Brasil";
export const REMETENTE = `${REMETENTE_NOME} <${REMETENTE_EMAIL}>`;

/** Remetente de sistema, só para e-mail interno. */
export const REMETENTE_INTERNO_PADRAO = "Viva Nomads <nao-responder@vivanomads.com.br>";

/**
 * De quem sai e para onde vai a resposta. Cliente: sempre REMETENTE (um RESEND_FROM diferente é ignorado — o PR
 * avisa para ajustar a variável). Interno: o `from` pedido, ou RESEND_FROM, ou o de sistema.
 */
export function remetenteDoEnvio(o: { interno?: boolean; from?: string; replyTo?: string; resendFrom?: string }): { from: string; replyTo?: string } {
  if (!o.interno) return { from: REMETENTE, replyTo: REMETENTE_EMAIL };
  return { from: o.from ?? o.resendFrom ?? REMETENTE_INTERNO_PADRAO, ...(o.replyTo ? { replyTo: o.replyTo } : {}) };
}
