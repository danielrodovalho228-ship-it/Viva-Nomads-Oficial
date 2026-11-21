/*
  E1007 — "Meus dados" não rolava até a seção da âncora (/dashboard/conta/dados#documento abria no topo).
  O navegador só rola até a âncora que já existe quando a página chega; aqui a seção é desenhada depois, e os blocos de
  cima ainda mudam de altura enquanto carregam. Regra pura do componente RolarAteAncora (node --test).
*/

/** Âncora simples: "#" + nome de seção (letras, números, "-" e "_", até 64). É o id do elemento a levar para a vista. */
const ANCORA_SIMPLES = /^#([A-Za-z0-9_-]{1,64})$/;

/** O id da seção pedida pela âncora, ou null quando não há âncora ou ela não é um nome de seção. */
export function ancoraParaRolar(hash: string | null | undefined): string | null {
  return ANCORA_SIMPLES.exec(hash ?? "")?.[1] ?? null;
}

/**
 * Por quanto tempo a tela acompanha a página assentar (blocos que carregam e empurram a seção). Depois disso, ou ao
 * primeiro gesto da pessoa, a tela não mexe mais na rolagem.
 */
export const JANELA_DE_ASSENTO_MS = 4000;
