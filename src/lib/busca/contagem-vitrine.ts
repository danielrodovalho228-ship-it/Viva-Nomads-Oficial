/*
  E446 — a FONTE ÚNICA da contagem da vitrine. PURO (node --test src/lib/busca/contagem-vitrine.test.ts).
  O conjunto que um visitante enxerga é decidido UMA vez (com imóvel real, os exemplos saem; sem nenhum real, os exemplos
  aparecem; `?exemplos=1` mantém tudo) e todas as contagens partem dele: lista e pílulas da busca, grade de bairros, página do
  bairro e total da cidade. Antes, as páginas de cidade/bairro contavam os exemplos sempre e a busca não.
*/
import { baseDaBusca } from "./exemplos-e-pedido.ts";
import { slugBairro } from "../bairros.ts";

export function baseDaVitrine<T extends { id: string }>(imoveis: T[], ehExemplo: (x: T) => boolean, forcarExemplos = false): T[] {
  return baseDaBusca(imoveis, ehExemplo, forcarExemplos);
}

export function totalDaVitrine(base: readonly unknown[]): number {
  return base.length;
}

/** Bairros da base, do mais cheio ao mais vazio (empate: ordem alfabética). A soma é sempre o total da base. */
export function bairrosDaVitrine(base: readonly { neighborhood: string }[]): { slug: string; nome: string; total: number }[] {
  const mapa = new Map<string, { slug: string; nome: string; total: number }>();
  for (const i of base) {
    const slug = slugBairro(i.neighborhood);
    if (!slug) continue;
    const atual = mapa.get(slug);
    if (atual) atual.total += 1;
    else mapa.set(slug, { slug, nome: i.neighborhood.trim(), total: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}
