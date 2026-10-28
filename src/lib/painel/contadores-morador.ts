/*
  E181 — os números do Início do morador vêm das MESMAS fontes das listas (família E16/E113: um número, uma fonte).
    • Favoritos: a lista de /dashboard/favoritos (useFavoritos). Enquanto os imóveis carregam, conta os ids guardados;
      depois, os imóveis que a lista mostra (um id de imóvel que saiu do ar não conta).
    • Buscas salvas: o tamanho de listarBuscasSalvas(), a mesma consulta de /dashboard/buscas.
  PURO. Roda: node --test src/lib/painel/contadores-morador.test.ts
*/

export function totalFavoritos({ ids, favoritos, loading }: { ids: readonly string[]; favoritos: readonly unknown[]; loading: boolean }): number {
  return loading && favoritos.length === 0 ? ids.length : favoritos.length;
}
