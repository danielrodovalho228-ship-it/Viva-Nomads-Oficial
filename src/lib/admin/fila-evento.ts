/**
 * Prompt 36, item 3b — o selo "N aguardando" da barra lateral do admin é lido NO CLIENTE (dashboard-shell, pelo GET
 * /api/painel/contadores desde o Prompt 42); aprovar/recusar não muda a rota, então o selo ficava velho.
 * Depois de cada decisão, a fila avisa por este evento e a barra lateral lê o número de novo (sem recarregar).
 */
export const EVENTO_FILA_DOCUMENTOS = "vn:fila-documentos-mudou";

/** Avisa a barra lateral que a fila de documentos mudou (no servidor, sem window, não faz nada). */
export function avisarFilaDocumentosMudou(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_FILA_DOCUMENTOS));
}
