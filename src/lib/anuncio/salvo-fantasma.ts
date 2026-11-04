/*
  E516 (QA de cliques do proprietário, 02/11) — abrir o assistente atualizava "Salvo às …" sem nenhuma edição: aplicar o
  rascunho carregado mudava o estado do formulário, o JSON do autosave mudava e, 2 s depois, o autosave gravava e
  carimbava a hora. Regra: só uma mudança de CONTEÚDO conta como salvamento visível. A navegação entre passos (passo
  atual, o mais longe visitado, a versão da ordem) segue gravada em silêncio, sem mexer no "Salvo às". PURO.
  Roda: node --test src/lib/anuncio/salvo-fantasma.test.ts
*/

/** Campos de navegação do JSON do rascunho: gravados, mas não são "edição". */
export const CAMPOS_DE_NAVEGACAO = ["step", "etapaMax", "ordemEtapas"] as const;

/** O conteúdo do rascunho sem os campos de navegação (para comparar com o que já estava salvo). */
export function conteudoDoRascunho(json: string): string {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    for (const k of CAMPOS_DE_NAVEGACAO) delete o[k];
    return JSON.stringify(o);
  } catch {
    return json;
  }
}

export type DecisaoAutosave = "base" | "silencioso" | "edicao";

/**
 * O que fazer com uma mudança do JSON do rascunho:
 *  - "base": o rascunho acabou de ser aberto (aplicado) — esse estado é o ponto de partida; não grava nem carimba;
 *  - "silencioso": só a navegação mudou — grava sem mostrar "Salvando…"/"Salvo às";
 *  - "edicao": o conteúdo mudou — grava e mostra "Salvo às …".
 */
export function decisaoAutosave(i: { aguardandoBase: boolean; base: string | null; conteudo: string }): DecisaoAutosave {
  if (i.aguardandoBase) return "base";
  if (i.base !== null && i.conteudo === i.base) return "silencioso";
  return "edicao";
}
