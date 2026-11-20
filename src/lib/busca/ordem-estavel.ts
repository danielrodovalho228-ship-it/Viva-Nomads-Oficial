/*
  E755 — a vitrine não troca de ordem entre carregamentos da mesma busca.
  Empate (mesma data de cadastro, mesma prioridade, mesmo preço) desempata SEMPRE pelo id: sem isso o Postgres e o
  sort devolvem a ordem de entrada, que muda entre consultas quando as linhas têm o mesmo created_at (lotes de massa).
*/
import { searchPriority, tierFromPhotoCount } from "../listing.ts";
import { prioridadeNaBusca } from "../preco-justo.ts";
export function desempatePorId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}


/**
 * E810 — a ordem de RELEVÂNCIA da busca (sem endereço): anúncios mais completos primeiro (fotos + Preço justo), empate
 * pelo id. Função pura e sem relógio nem sorteio: a mesma lista sai na mesma ordem em qualquer carregamento.
 */
export function comparaRelevancia(
  a: { id: string; photos: readonly unknown[]; precoJusto?: boolean },
  b: { id: string; photos: readonly unknown[]; precoJusto?: boolean },
): number {
  return (
    prioridadeNaBusca(searchPriority(tierFromPhotoCount(b.photos.length)), b.precoJusto) -
      prioridadeNaBusca(searchPriority(tierFromPhotoCount(a.photos.length)), a.precoJusto) || desempatePorId(a, b)
  );
}
