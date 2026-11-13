/*
  E869 — leitura do link da /buscar. O que a busca não conhece SAI da URL e é nomeado num aviso (antes ficava na URL sem
  filtrar: o link compartilhado mostrava todos os imóveis como se o filtro valesse). `cidade` — o que os nossos e-mails e a
  página de anúncio pausado mandam — é lido como `local`. Rastreio de campanha (utm_*, gclid, fbclid) não é filtro: fica. PURO.
*/
import { COMODIDADES_FILTRAVEIS } from "./filtro-comodidades.ts";

/** Toda chave que a /buscar lê ou escreve (search-client + filtro-internet, filtro-nivel, destino-busca, datas-flexiveis, exemplos). */
export const CHAVES_DA_BUSCA: ReadonlySet<string> = new Set([
  "local", "lat", "lng", "r", "orcamento", "preco", "quartos", "adultos", "criancas", "periodo", "ordem", "tipo", "faixa",
  "entrada", "flex", "garantia", "pet", "porte", "mobiliado", "pronto", "homeoffice", "localizado", "nota", "seguro",
  "gestor", "negocia", "precojusto", "comod", "internet", "medida", "nivel", "niveis",
  "ate", "destino", "dlat", "dlng", "drot", "modo", "exemplos",
]);

const RASTREIO = /^(utm_[a-z_]+|gclid|fbclid)$/;

export function lerLinkDaBusca(sp: URLSearchParams): { limpo: URLSearchParams; ignorados: string[] } {
  const limpo = new URLSearchParams(sp);
  const ignorados: string[] = [];
  const cidade = limpo.get("cidade");
  if (cidade !== null) {
    if (!limpo.get("local") && cidade.trim()) limpo.set("local", cidade.trim());
    limpo.delete("cidade");
  }
  for (const k of [...new Set(limpo.keys())]) {
    if (CHAVES_DA_BUSCA.has(k) || RASTREIO.test(k)) continue;
    ignorados.push(k);
    limpo.delete(k);
  }
  const comod = limpo.get("comod");
  if (comod !== null) {
    const validas = new Set<string>(COMODIDADES_FILTRAVEIS.map((c) => c.chave));
    const itens = comod.split(",").map((s) => s.trim()).filter(Boolean);
    for (const c of itens) if (!validas.has(c)) ignorados.push(`comod=${c}`);
    const ok = itens.filter((c) => validas.has(c));
    if (ok.length) limpo.set("comod", ok.join(","));
    else limpo.delete("comod");
  }
  return { limpo, ignorados };
}

export function avisoLinkIgnorado(ignorados: readonly string[]): string | null {
  if (!ignorados.length) return null;
  const lista = ignorados.map((k) => `“${k}”`).join(", ");
  return ignorados.length === 1
    ? `Este link tinha um filtro que a busca não reconhece (${lista}). Ele foi ignorado: a lista abaixo não usa esse filtro.`
    : `Este link tinha filtros que a busca não reconhece (${lista}). Eles foram ignorados: a lista abaixo não usa esses filtros.`;
}
