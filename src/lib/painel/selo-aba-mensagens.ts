/*
  E970 (ligação na casca) — o selo da aba Mensagens, no menu do computador e na barra do celular.
  A unidade é a CONVERSA (coordenador, ORDEM-DUET-068, ponto 3): o selo conta as conversas com pelo menos uma não lida.
  O número é o contador `conversasNaoLidas` do painel, que entra com a parte de dados do E970 (#3892). A casca o lê
  quando ele existe; sem ele (ou com valor que não é contagem) não há selo. Puro (node --test).
*/

/** Conversas com não lida para o selo da aba Mensagens; 0 = sem selo. */
export function seloDaAbaMensagens(contadores: unknown): number {
  const n = (contadores as { conversasNaoLidas?: unknown } | null | undefined)?.conversasNaoLidas;
  return typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0;
}
