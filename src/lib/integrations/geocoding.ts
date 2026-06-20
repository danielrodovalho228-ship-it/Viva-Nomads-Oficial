/**
 * Geocoding de endereço (Mapbox) — rodada de mapa.
 *
 * Converte texto livre ("Av. Getúlio Vargas, 123" ou um bairro) em coordenadas,
 * usado no autocomplete da busca para filtrar imóveis por raio. Sem
 * NEXT_PUBLIC_MAPBOX_TOKEN o recurso fica desligado (geocodingEnabled = false) e
 * a busca cai para o autocomplete de bairros por nome (modo demonstração).
 *
 * Usa o endpoint REST de geocoding direto (fetch) — o token público do Mapbox
 * é desenhado para uso no cliente, então não precisamos de SDK nem rota de API.
 */

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Há token configurado? Quando false, o autocomplete usa a lista de bairros. */
export const geocodingEnabled = Boolean(TOKEN);

export interface GeoSuggestion {
  id: string;
  /** Rótulo legível (ex.: "Centro, Uberlândia - MG"). */
  label: string;
  lat: number;
  lng: number;
}

// Centro aproximado de Uberlândia — enviesa as sugestões para a cidade atendida.
const PROXIMITY = "-48.262,-18.911";

/**
 * Busca sugestões de endereço para `query`. Retorna [] sem token ou para
 * consultas muito curtas (não é "falha", é "nada a buscar"). Em erro de rede
 * ou HTTP, LANÇA — assim quem chama distingue "nenhum resultado" de "falhou" e
 * pode oferecer um fallback (ex.: buscar por nome do bairro). Aceita um
 * AbortSignal para cancelar requisições em voo enquanto o usuário digita
 * (o AbortError se propaga como qualquer outra exceção).
 */
export async function geocodeAddress(
  query: string,
  signal?: AbortSignal
): Promise<GeoSuggestion[]> {
  const q = query.trim();
  if (!TOKEN || q.length < 3) return [];

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${TOKEN}` +
    `&country=br` +
    `&proximity=${PROXIMITY}` +
    `&language=pt` +
    `&limit=5` +
    `&types=address,neighborhood,locality,place,poi`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as {
    features?: { id: string; place_name: string; center: [number, number] }[];
  };
  return (data.features ?? []).map((f) => ({
    id: f.id,
    label: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}
