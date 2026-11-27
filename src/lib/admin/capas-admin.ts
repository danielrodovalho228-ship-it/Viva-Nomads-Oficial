import { ehUrlDeImagem } from "../fotos-anuncio.ts";

/**
 * Onda 5 (matriz admin-anuncios): capa de cada anúncio na lista do admin — a foto de menor ordem que é URL de imagem
 * (o "nome" de uma foto de teste não vira capa, regra do E405). Sem foto válida, o anúncio fica fora do mapa e a tela
 * desenha o espaço "sem foto".
 */
export function capasPorImovel(linhas: { property_id: string; url: string | null; sort_order: number | null }[]): Map<string, string> {
  const melhor = new Map<string, { url: string; ordem: number }>();
  for (const l of linhas) {
    if (!ehUrlDeImagem(l.url)) continue;
    const ordem = l.sort_order ?? Number.MAX_SAFE_INTEGER;
    const atual = melhor.get(l.property_id);
    if (!atual || ordem < atual.ordem) melhor.set(l.property_id, { url: l.url, ordem });
  }
  return new Map([...melhor].map(([id, v]) => [id, v.url]));
}

/** Divide a lista em lotes de `n` (o `.in()` com 3000 ids estoura a URL e o limite de linhas da API). */
export function emLotes<T>(itens: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += n) out.push(itens.slice(i, i + n));
  return out;
}
