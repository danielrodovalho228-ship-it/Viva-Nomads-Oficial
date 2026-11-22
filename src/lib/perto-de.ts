/*
  E889: a lista /imoveis-perto-de/<destino> lê a MESMA base da página da região (polo), da cidade e da busca: os anúncios
  da cidade do destino, sem anúncio de teste, e na regra da vitrine (exemplos enquanto não há imóvel real; só reais quando
  houver). Antes descartava todo exemplo e abria vazia no pré-lançamento. PURO.
*/
import { baseDaVitrine } from "./busca/contagem-vitrine.ts";
import { chaveCidade } from "./cidades.ts";
import { ehAnuncioDeTeste } from "./data/anuncio-teste.ts";

export function baseDoPertoDe<T extends { id: string; city?: string | null; title?: string | null }>(
  todos: T[],
  cidade: string,
  ehExemplo: (x: T) => boolean,
): T[] {
  const daCidade = todos.filter((p) => chaveCidade(p.city ?? "") === chaveCidade(cidade) && !ehAnuncioDeTeste(p.title));
  return baseDaVitrine(daCidade, ehExemplo);
}
