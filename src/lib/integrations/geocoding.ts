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

/** Centro de Uberlândia — fallback seguro quando não há coordenada do endereço. */
export const UBERLANDIA_CENTER = { lat: -18.9113, lng: -48.2622 };

/**
 * Sanidade de coordenada: descarta (0,0)/oceano e valores fora do Brasil
 * continental. Evita "jogar o pino no oceano" quando o geocoding falha ou
 * devolve algo estranho. Limites aproximados do território brasileiro.
 */
function isPlausibleBR(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -34 && lat <= 6 && lng >= -74 && lng <= -33;
}

/**
 * Converte um endereço (rua/bairro/cidade) em coordenadas para gravar no
 * imóvel ao salvar. NUNCA lança e SEMPRE devolve uma coordenada utilizável:
 * - sem token ou endereço fraco → centro da cidade (Uberlândia) como aproximação;
 * - geocoding com resultado implausível (oceano/0,0) → mesmo fallback.
 * Assim o imóvel novo aparece no mapa e nos filtros por raio sem quebrar.
 */
export async function geocodeForSave(parts: {
  street?: string;
  neighborhood?: string;
  city?: string;
}): Promise<{ lat: number; lng: number; approximate: boolean }> {
  const fallback = { ...UBERLANDIA_CENTER, approximate: true };

  const query = [parts.street, parts.neighborhood, parts.city, "Brasil"]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  if (!TOKEN || query.length < 3) return fallback;

  try {
    const results = await geocodeAddress(query);
    const hit = results.find((r) => isPlausibleBR(r.lat, r.lng));
    if (hit) return { lat: hit.lat, lng: hit.lng, approximate: false };
  } catch {
    /* rede/HTTP — cai no fallback do centro da cidade */
  }
  return fallback;
}

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
