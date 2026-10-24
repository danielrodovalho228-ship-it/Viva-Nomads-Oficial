/*
  A2 — Conta › Avaliações (mockup perfil-02): o que a tela decide além das regras da Pista B. Puro.
*/
import type { AvaliacaoRecebida } from "./avaliacoes-recebidas.ts";

/** O subtítulo do desenho, no vocabulário da casa ("anfitriões e inquilinos" → proprietários e moradores). */
export const SUBTITULO_AVALIACOES = "Avaliações que você recebeu de proprietários e moradores";

/** Estrelas cheias de uma nota de 0 a 5 (meia arredonda para cima, como na reputação pública). */
export function estrelasDaNota(nota: number): number {
  if (!Number.isFinite(nota)) return 0;
  return Math.min(5, Math.max(0, Math.round(nota)));
}

/** "Responder avaliações" leva à primeira avaliação da lista ainda sem resposta; sem nenhuma, o botão não aparece. */
export function primeiraSemResposta(lista: Pick<AvaliacaoRecebida, "id" | "resposta">[]): string | null {
  return lista.find((a) => !a.resposta)?.id ?? null;
}
