/*
  E615: a URL do assistente diz SEMPRE o passo atual. `?etapa=` ficava no valor com que a página abriu (ex.: etapa=4
  nos Passos 5 a 10), e atualizar a página ou abrir o link devolvia ao passo errado. Grava o NOME do passo (o mesmo que
  `etapaDaUrl` lê: tipo, fotos, endereco, …) e mantém o resto da busca (draft, qualificacao).
  PURO. Roda: node --test src/lib/anuncio/e615-etapa-na-url.test.ts
*/
import { ETAPAS } from "../etapas-anuncio.ts";

/** A busca (`?…`) com `etapa` trocado pelo passo `step` (0..9); passo fora da faixa devolve a busca como veio. */
export function urlComEtapa(search: string, step: number): string {
  const nome = ETAPAS[step];
  const busca = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!nome) return busca.toString() ? `?${busca.toString()}` : "";
  busca.set("etapa", nome);
  return `?${busca.toString()}`;
}
