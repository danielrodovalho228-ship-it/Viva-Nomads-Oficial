/*
  Chat da Viva — partes leves usadas no NAVEGADOR (saudação e a conversa
  anexada ao chamado). O resto (prompt com as fontes, regras) fica no servidor.
*/
export interface MsgChat {
  role: "user" | "assistant";
  content: string;
}

export const SAUDACAO_CHAT = "Oi! Sou a Viva, assistente virtual da Viva Nomads. Posso tirar dúvidas sobre como funciona, planos, Caução e contratos. Como posso ajudar?";

/** Conversa anexada ao chamado quando a pessoa pede uma pessoa (cabe nos 4000 do chamado). */
export function transcricaoChat(msgs: MsgChat[], pedido?: string): string {
  const linhas = msgs.map((m) => `${m.role === "user" ? "Pessoa" : "Viva"}: ${m.content.replace(/\s+/g, " ").trim()}`);
  const cab = "Conversa com a Viva no chat do site:";
  let corpo = linhas.join("\n");
  const extra = pedido?.trim() ? `\n\nPedido para a equipe: ${pedido.trim()}` : "";
  const max = 4000 - cab.length - extra.length - 2;
  if (corpo.length > max) corpo = "…" + corpo.slice(corpo.length - max + 1);
  return `${cab}\n${corpo}${extra}`;
}
