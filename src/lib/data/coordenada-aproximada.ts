/*
  Coordenada aproximada para listagens PÚBLICAS (pins da busca, home, cidades).
  Mesma precisão de property-map.tsx (3 casas ≈ 110 m): o ponto exato do imóvel
  só é conhecido de quem tem acesso ao anúncio, nunca vai no payload da busca.
*/
export const aproximarCoordenada = (n: number): number => Math.round(n * 1000) / 1000;

/** Devolve cópia do imóvel com lat/lng arredondados (não muta a entrada). */
export function comCoordenadaAproximada<T extends { lat: number; lng: number }>(p: T): T {
  return { ...p, lat: aproximarCoordenada(p.lat), lng: aproximarCoordenada(p.lng) };
}
