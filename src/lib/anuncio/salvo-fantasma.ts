/*
  E516 (QA de cliques do proprietário, 02/11) — abrir o assistente atualizava "Salvo às …" sem nenhuma edição: aplicar o
  rascunho carregado mudava o estado do formulário, o JSON do autosave mudava e, 2 s depois, o autosave gravava e
  carimbava a hora. Regra: só uma mudança de CONTEÚDO conta como salvamento visível. A navegação entre passos (passo
  atual, o mais longe visitado, a versão da ordem) segue gravada em silêncio, sem mexer no "Salvo às". PURO.
  Roda: node --test src/lib/anuncio/salvo-fantasma.test.ts
*/

/** Campos de navegação do JSON do rascunho: gravados, mas não são "edição". */
/** E614: `confirmados` também — o "Continuar" confirma o valor pronto (preço, garantia, período) sem editar nada. */
export const CAMPOS_DE_NAVEGACAO = ["step", "etapaMax", "ordemEtapas", "confirmados"] as const;

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
 *  - "base": o rascunho acabou de ser aberto (aplicado) e ninguém mexeu — esse estado é o ponto de partida; não grava
 *    nem carimba (se a pessoa já digitou/marcou algo nesse meio-tempo, é "edicao"; se só confirmou um valor pronto
 *    com o Continuar, é "silencioso" — E614: a confirmação tem de chegar ao servidor);
 *  - "silencioso": só a navegação mudou — grava sem mostrar "Salvando…"/"Salvo às";
 *  - "edicao": o conteúdo mudou — grava e mostra "Salvo às …".
 */
export function decisaoAutosave(i: { aguardandoBase: boolean; editou?: boolean; confirmou?: boolean; navegou?: boolean; base: string | null; conteudo: string }): DecisaoAutosave {
  // Uma edição real (digitar, marcar) logo depois de abrir não é engolida pela base: vale como edição.
  // E614: uma confirmação (Continuar) nesse meio-tempo também não é engolida: grava em silêncio.
  // E614 (retoma): nem a navegação — trocar de passo antes de o rascunho aberto assentar grava o passo em silêncio
  // (antes virava base e o passo retomado não persistia).
  if (i.aguardandoBase) return i.editou ? "edicao" : i.confirmou || i.navegou ? "silencioso" : "base";
  if (i.base !== null && i.conteudo === i.base) return "silencioso";
  return "edicao";
}

/**
 * E614 (regra do Gerente, DUET-1719): o rascunho retomado mostra sempre "Salvo às HH:MM" da última gravação — também
 * no Passo 3 e sem nenhuma edição. Cada gravação carimba `salvoEm` (ISO) no draft_data; aqui vira a hora do indicador,
 * no fuso dado (o do navegador quando omitido). Sem carimbo válido (rascunho anterior à regra): null.
 */
export function salvoAsDoRascunho(d: { salvoEm?: unknown }, timeZone?: string): string | null {
  if (typeof d.salvoEm !== "string") return null;
  const t = Date.parse(d.salvoEm);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) });
}
