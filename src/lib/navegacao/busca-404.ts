/*
  E1019 (t1629, E916): a busca da 404 perdia o texto digitado. A sonda da Pista 3 mostrou o campo "Uberlândia" vazio
  antes do clique: o campo é trocado por um nó novo (a 404 volta a ser montada depois da hidratação) e o que a pessoa
  digitou no nó antigo some — o formulário vai para /buscar sem ?local=.
  A correção guarda o texto a cada tecla (sessionStorage, por pouco tempo) e, quando o campo volta a ser montado vazio,
  repõe-no; no envio, se o campo chegar vazio com um texto recente guardado, o envio leva o texto guardado.
*/

export const CHAVE_BUSCA_404 = "vn-404-local";
/** O texto guardado vale por 2 minutos: é para o campo que acabou de ser trocado, não para a próxima visita. */
export const VALIDADE_BUSCA_404_MS = 2 * 60_000;

/**
 * Script em linha, posto na 404 logo depois do formulário: escuta as teclas no `document` (não no campo), por isso
 * continua a guardar mesmo antes da hidratação e depois de o campo ser trocado por um nó novo. Mesmo formato de
 * `guardarBusca404`.
 */
export const SCRIPT_GUARDA_BUSCA_404 = `document.addEventListener("input",function(e){var t=e.target;if(!t||t.id!=="nao-encontrada-local")return;try{sessionStorage.setItem(${JSON.stringify(CHAVE_BUSCA_404)},JSON.stringify({t:Date.now(),v:t.value}))}catch(_){}},true);`;

export function guardarBusca404(texto: string, agora: number): string {
  return JSON.stringify({ t: agora, v: texto });
}

/**
 * O texto a repor no campo: só quando o campo está vazio e há um texto guardado, não vazio e recente.
 * Qualquer outra situação (campo já com texto, nada guardado, guardado velho ou corrompido): null.
 */
export function textoParaRepor(atual: string, guardado: string | null, agora: number): string | null {
  if (atual.trim() !== "" || !guardado) return null;
  try {
    const g = JSON.parse(guardado) as { t?: unknown; v?: unknown };
    if (typeof g.t !== "number" || typeof g.v !== "string") return null;
    if (g.v.trim() === "" || agora - g.t < 0 || agora - g.t > VALIDADE_BUSCA_404_MS) return null;
    return g.v;
  } catch {
    return null;
  }
}

/*
  E1019 (prova de chegada de 19/11, ORDEM-DUET-194): na 404 ao vivo, digitar, seguir por "Buscar imóveis" e voltar
  deixava o campo vazio — só sobrevivia por sorte do cache do navegador. Agora o termo vai (1) no link "Buscar imóveis"
  e (2) na própria URL da 404 (?local=…, por history.replaceState a cada tecla), por isso o Voltar volta a uma URL que já
  traz o termo e o campo é reposto dela — sem depender do tempo nem da cache.
*/
export const PARAM_BUSCA_404 = "local";

/** O href de "Buscar imóveis": leva o termo quando há um; sem termo, a /buscar de sempre. */
export function hrefBuscarImoveis(termo: string): string {
  const t = termo.trim();
  return t ? `/buscar?${PARAM_BUSCA_404}=${encodeURIComponent(t)}` : "/buscar";
}

/** A URL da 404 com o termo (ou sem ele, se vazio), mantendo o caminho, os outros parâmetros e a âncora. */
export function urlDa404ComTermo(pathname: string, search: string, hash: string, termo: string): string {
  const p = new URLSearchParams(search);
  const t = termo.trim();
  if (t) p.set(PARAM_BUSCA_404, termo);
  else p.delete(PARAM_BUSCA_404);
  const q = p.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash}`;
}

/** O termo guardado na URL da 404 (vazio se não houver). */
export function termoDaUrl404(search: string): string {
  return new URLSearchParams(search).get(PARAM_BUSCA_404) ?? "";
}
