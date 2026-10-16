/*
  Configuração única do mapa-base (ordens 0ee6d5f6, 64005753, b4fd5b18): a /buscar
  e a página do imóvel usam o MESMO caminho. Com NEXT_PUBLIC_MAPBOX_TOKEN, Mapbox
  GL; sem ele, Leaflet + CARTO Voyager. Sem chave da CARTO nenhum tile é pedido
  (pedir sem chave traz o carimbo "API KEY REQUIRED").
*/

/** Chave gratuita da CARTO — vem da variável de ambiente, nunca do código. */
export const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

/** Modelo de URL dos tiles; `null` sem chave (mapa-base desligado). */
export const TILES_CARTO = CARTO_KEY ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY)}` : null;

export const ATRIBUICAO_MAPA = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Qual motor desenha o mapa: Mapbox só com token; senão Leaflet + CARTO. */
export function motorDoMapa(mapboxToken?: string | null): "mapbox" | "leaflet" {
  return mapboxToken ? "mapbox" : "leaflet";
}

/** Raio (km) da área aproximada exibida na página do imóvel (~500 m). */
export const RAIO_APROXIMADO_KM = 0.5;

/** Arredonda ~3 casas (≈110 m): nunca o ponto exato do imóvel (privacidade). */
export const borrarCoordenada = (n: number) => Math.round(n * 1000) / 1000;
