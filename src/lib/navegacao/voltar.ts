/*
  E69 — o "voltar" das subtelas no celular volta para onde a pessoa estava. Puro (node --test).
  A navegação do Next dentro do site não muda o document.referrer; por isso o painel marca, na sessão, que houve
  troca de rota (CHAVE_NAV_INTERNA). Abertura direta (link de e-mail, recarga numa aba nova) → destino padrão.
*/
export const CHAVE_NAV_INTERNA = "vivanomads-nav-interna";

export function veioDeDentroDoSite(referrer: string, origem: string, tamanhoHistorico: number, navInterna = lerNavInterna()): boolean {
  if (tamanhoHistorico <= 1) return false;
  if (navInterna) return true;
  return !!referrer && (referrer === origem || referrer.startsWith(origem + "/"));
}

function lerNavInterna(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(CHAVE_NAV_INTERNA) === "1";
  } catch {
    return false;
  }
}

/** Chamado pelo painel a cada troca de rota feita dentro do site (não na primeira carga). */
export function marcarNavInterna(): void {
  try {
    sessionStorage.setItem(CHAVE_NAV_INTERNA, "1");
  } catch {
    /* sem armazenamento: o voltar usa o destino padrão */
  }
}
