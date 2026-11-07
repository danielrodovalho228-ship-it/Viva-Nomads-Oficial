/*
  E674 — o que fica no navegador (localStorage "vivanomads-auth") pertence a UMA conta. Quando outra conta entra no
  mesmo navegador, o modo ativo e o papel "parceiro" da anterior não valem para ela. Pura (node --test).
*/
export type EstadoTrocaDeConta = { trocou: false } | { trocou: true; activeMode: null; parceiroAtivo: false };

export function estadoAoTrocarDeConta(anteriorId: string | null | undefined, novoId: string | null | undefined): EstadoTrocaDeConta {
  if (!anteriorId || !novoId || anteriorId === novoId) return { trocou: false };
  return { trocou: true, activeMode: null, parceiroAtivo: false };
}
