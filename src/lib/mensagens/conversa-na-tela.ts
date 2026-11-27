/**
 * E481 no celular (DUET-0605): a conversa só conta como lida quando a pessoa a abre e vê. A partir do breakpoint `md`
 * a tela de Mensagens é dividida (lista + conversa aberta ao lado); abaixo dele, mostra a lista OU a conversa.
 */
export const VISTA_DIVIDIDA = "(min-width: 768px)";

/** A conversa que está de fato na tela (a que pode ser marcada como lida), ou null quando só a lista aparece. */
export function conversaNaTela(p: { ativaId: string | null | undefined; vistaDividida: boolean; vistaCelular: "list" | "chat" }): string | null {
  if (!p.ativaId) return null;
  return p.vistaDividida || p.vistaCelular === "chat" ? p.ativaId : null;
}
