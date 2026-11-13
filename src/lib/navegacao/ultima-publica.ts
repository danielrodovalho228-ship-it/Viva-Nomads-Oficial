/*
  E784 — "‹ Voltar ao site" no admin devolve a pessoa à ÚLTIMA página pública em que ela estava antes de entrar no admin; quem
  entrou direto sai para a HOME. Nunca /buscar, a não ser que a busca tenha sido a página anterior dela. Puro (node --test).
  O site público grava a rota a cada troca (RastroPublico); o admin lê. Guardada na sessão da aba (sessionStorage).
*/
export const CHAVE_ULTIMA_PUBLICA = "vivanomads-ultima-publica";
export const DESTINO_PADRAO_VOLTAR_AO_SITE = "/";

/** Rota PÚBLICA: tudo que não é painel, equipe, porta de entrada ou API. */
export function ehRotaPublica(rota: string): boolean {
  if (!rota.startsWith("/") || rota.startsWith("//")) return false;
  return !/^\/(dashboard|admin|auth|api|entrar|sair)(?:[/?#]|$)/.test(rota);
}

export function guardarUltimaPublica(rota: string): void {
  if (!ehRotaPublica(rota)) return;
  try {
    sessionStorage.setItem(CHAVE_ULTIMA_PUBLICA, rota);
  } catch {
    /* sem armazenamento: o admin usa a home */
  }
}

/** Para onde o "Voltar ao site" leva: a última pública guardada (se for válida) ou a home. */
export function destinoVoltarAoSite(guardada: string | null | undefined): string {
  return guardada && ehRotaPublica(guardada) ? guardada : DESTINO_PADRAO_VOLTAR_AO_SITE;
}

export function lerUltimaPublica(): string | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(CHAVE_ULTIMA_PUBLICA);
  } catch {
    return null;
  }
}
