/*
  Resposta pública e pedido de revisão de avaliação (ordem 404cd213, item 4) —
  regras PURAS e testáveis. Espelham os checks da migração 0128.
*/
import { contemOfensa } from "./avaliacoes.ts";
import { contemContato } from "./pedidos/pedidos.ts";

/** Limite da resposta pública e do motivo da contestação. */
export const LIMITE_RESPOSTA = 500;
export const MIN_MOTIVO = 20;

/** A avaliação só sai do ar por regra objetiva (nunca por discordância). */
export const MOTIVOS_REVISAO = {
  ofensa: "Ofensa ou discriminação",
  dado_pessoal: "Dado pessoal (telefone, e-mail, endereço, documento)",
  fato_falso: "Fato falso, com comprovação",
} as const;
export type MotivoRevisao = keyof typeof MOTIVOS_REVISAO;

export const ehMotivoRevisao = (m: unknown): m is MotivoRevisao =>
  typeof m === "string" && Object.prototype.hasOwnProperty.call(MOTIVOS_REVISAO, m);

/** Valida a resposta do avaliado. Devolve a mensagem de erro ou null. */
export function validarResposta(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (t.length === 0) return "Escreva a resposta.";
  if (t.length > LIMITE_RESPOSTA) return `Resposta muito longa (máx. ${LIMITE_RESPOSTA}).`;
  if (contemContato(t)) return "Tire telefone, e-mail ou rede social da resposta: o contato acontece pela plataforma.";
  if (contemOfensa(t)) return "A resposta não pode ter ofensa. Reescreva com respeito.";
  return null;
}

/** Valida o pedido de revisão (motivo objetivo + explicação). */
export function validarContestacao(motivo: unknown, detalhe: string | null | undefined): string | null {
  if (!ehMotivoRevisao(motivo)) return "Escolha o motivo do pedido de revisão.";
  const d = (detalhe ?? "").trim();
  if (d.length < MIN_MOTIVO) return `Explique em pelo menos ${MIN_MOTIVO} caracteres.`;
  if (d.length > LIMITE_RESPOSTA) return `Explicação muito longa (máx. ${LIMITE_RESPOSTA}).`;
  return null;
}

/** Só o AVALIADO responde, e só a uma avaliação já PUBLICADA, uma vez. */
export function podeResponder(a: { alvoId: string; status: string; jaRespondida: boolean }, userId: string): boolean {
  return a.alvoId === userId && a.status === "publicada" && !a.jaRespondida;
}

/** Só o AVALIADO pede revisão, de avaliação publicada, uma pendência por vez. */
export function podeContestar(a: { alvoId: string; status: string; contestacaoAberta: boolean }, userId: string): boolean {
  return a.alvoId === userId && a.status === "publicada" && !a.contestacaoAberta;
}
