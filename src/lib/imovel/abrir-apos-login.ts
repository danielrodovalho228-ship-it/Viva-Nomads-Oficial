/*
  Visita no anúncio sem login (QA do Muse, 18/10): "Agendar visita" e "Visita por vídeo" levam ao login e, depois de
  entrar, voltam ao MESMO imóvel com a janela já aberta (?abrir=visita | ?abrir=video). Puro, para testar.
*/
export type AlvoAbrir = "visita" | "video";

/**
 * /auth?motivo=visita&redirect=/imoveis/<id>?abrir=<alvo> — o /auth só aceita caminho interno (safeInternalPath) e diz
 * o porquê da conta (Prompt 49: conta só no momento de valor).
 */
export function urlLoginParaAbrir(propertyId: string, alvo: AlvoAbrir): string {
  return `/auth?motivo=visita&redirect=${encodeURIComponent(`/imoveis/${encodeURIComponent(propertyId)}?abrir=${alvo}`)}`;
}

/** O que abrir ao carregar o anúncio (só os dois valores conhecidos). */
export function alvoAbrir(search: string): AlvoAbrir | null {
  const v = new URLSearchParams(search).get("abrir");
  return v === "visita" || v === "video" ? v : null;
}
