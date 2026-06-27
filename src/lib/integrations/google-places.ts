/*
  Integração Google Places + Distance Matrix — SOMENTE servidor.
  A chave (GOOGLE_MAPS_API_KEY, sem NEXT_PUBLIC) nunca vai ao browser: as telas
  chamam as rotas /api/places/* que usam estas funções.

  Regra do Google respeitada: persistimos só o place_id no banco; nome/endereço/
  distância são buscados em tempo real aqui e nunca gravados.
*/

const KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE = "https://maps.googleapis.com/maps/api";

export function isGooglePlacesConfigured(): boolean {
  return !!KEY;
}

/** Link do Google Maps montado a partir do place_id (atribuição exigida). */
export function mapsUrlForPlace(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

/** Autocomplete de lugares, centrado nas coordenadas do imóvel. [] sem chave/erro. */
export async function placesAutocomplete(
  query: string,
  center?: { lat: number; lng: number }
): Promise<PlaceSuggestion[]> {
  if (!KEY || query.trim().length < 3) return [];
  try {
    const params = new URLSearchParams({
      input: query,
      key: KEY,
      language: "pt-BR",
      components: "country:br",
    });
    if (center) {
      params.set("location", `${center.lat},${center.lng}`);
      params.set("radius", "8000");
    }
    const r = await fetch(`${BASE}/place/autocomplete/json?${params}`);
    const j = await r.json();
    if (j.status !== "OK" || !Array.isArray(j.predictions)) return [];
    return j.predictions.map((p: { place_id: string; description: string }) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  } catch {
    return [];
  }
}

export interface ResolvedPlace {
  placeId: string;
  categoria: string;
  rotulo?: string;
  name: string; // nome do lugar (ou rótulo no fallback)
  mapsUrl: string;
  distanceText?: string; // ex.: "1,2 km"
  durationText?: string; // ex.: "4 min"
  mode?: "walking" | "driving";
}

interface PlaceInput {
  placeId: string;
  categoria: string;
  rotulo?: string;
}

/** Nome de um lugar (Places Details). null sem chave/erro. */
async function placeName(placeId: string): Promise<string | null> {
  if (!KEY) return null;
  try {
    const params = new URLSearchParams({ place_id: placeId, fields: "name", key: KEY, language: "pt-BR" });
    const r = await fetch(`${BASE}/place/details/json?${params}`);
    const j = await r.json();
    return j.status === "OK" ? (j.result?.name ?? null) : null;
  } catch {
    return null;
  }
}

/** Distância/tempo do imóvel até cada place_id (uma chamada). Mapa vazio sem chave/erro. */
async function distances(
  origin: { lat: number; lng: number },
  placeIds: string[],
  mode: "walking" | "driving"
): Promise<Map<string, { distanceText: string; durationText: string }>> {
  const out = new Map<string, { distanceText: string; durationText: string }>();
  if (!KEY || placeIds.length === 0) return out;
  try {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: placeIds.map((id) => `place_id:${id}`).join("|"),
      mode,
      key: KEY,
      language: "pt-BR",
    });
    const r = await fetch(`${BASE}/distancematrix/json?${params}`);
    const j = await r.json();
    const row = j.rows?.[0]?.elements;
    if (j.status !== "OK" || !Array.isArray(row)) return out;
    placeIds.forEach((id, i) => {
      const el = row[i];
      if (el?.status === "OK" && el.distance && el.duration) {
        out.set(id, { distanceText: el.distance.text, durationText: el.duration.text });
      }
    });
    return out;
  } catch {
    return out;
  }
}

/**
 * Resolve nome + distância em tempo real para a lista de lugares de um imóvel.
 * Fallback elegante: sem chave (ou erro/cota), devolve nome=rótulo sem distância,
 * nunca lança. A pé por padrão (perfil do público); cai para carro se a pé falhar.
 */
export async function resolveProximities(
  origin: { lat: number; lng: number },
  places: PlaceInput[]
): Promise<ResolvedPlace[]> {
  if (places.length === 0) return [];
  const ids = places.map((p) => p.placeId);

  if (!KEY) {
    // Fallback total (sem chave): só rótulo + link do Maps.
    return places.map((p) => ({
      ...p,
      name: p.rotulo || "Local",
      mapsUrl: mapsUrlForPlace(p.placeId),
    }));
  }

  const [names, walk] = await Promise.all([
    Promise.all(ids.map((id) => placeName(id))),
    distances(origin, ids, "walking"),
  ]);
  // Para os que não têm caminhada (muito longe), tenta de carro.
  const missing = ids.filter((id) => !walk.has(id));
  const drive = missing.length > 0 ? await distances(origin, missing, "driving") : new Map();

  return places.map((p, i) => {
    const w = walk.get(p.placeId);
    const d = drive.get(p.placeId);
    const dist = w ?? d;
    return {
      ...p,
      name: names[i] ?? p.rotulo ?? "Local",
      mapsUrl: mapsUrlForPlace(p.placeId),
      distanceText: dist?.distanceText,
      durationText: dist?.durationText,
      mode: w ? "walking" : d ? "driving" : undefined,
    };
  });
}
