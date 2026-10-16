/**
 * Quem respondeu o chamado (ordem 7436a29a, item 1): o e-mail "Seu chamado foi respondido" e a
 * conversa do chamado dizem se foi a assistente virtual ou uma pessoa da equipe. Fonte única dos rótulos.
 */
export const ROTULO_QUEM_RESPONDEU = {
  viva: "Viva (assistente virtual)",
  equipe: "Equipe Viva Nomads (pessoa)",
} as const;

export type QuemRespondeu = keyof typeof ROTULO_QUEM_RESPONDEU;

/** Linha do e-mail (HTML) com o rótulo de quem respondeu. Texto fixo: nada vindo do usuário. */
export function linhaQuemRespondeuHtml(quem: QuemRespondeu): string {
  return `<p style="margin:12px 0 0;color:#0f1722;font-size:14px;">Respondido por: <strong>${ROTULO_QUEM_RESPONDEU[quem]}</strong></p>`;
}
