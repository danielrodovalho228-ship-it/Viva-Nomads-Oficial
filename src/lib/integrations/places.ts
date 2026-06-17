/*
  Google Places (Nearby Search) — popula os espaços de trabalho próximos ao
  imóvel (coworking, café, sala de reunião) que sustentam o selo "Pronto para
  Trabalho". Sem GOOGLE_PLACES_API_KEY, retorna exemplos (modo demonstração).
  Docs: https://developers.google.com/maps/documentation/places/web-service
*/

import type { Workspace, WorkspaceType } from "@/lib/types";

export function isPlacesConfigured() {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

const TYPE_QUERY: Record<WorkspaceType, string> = {
  coworking: "coworking space",
  cafe: "cafe",
  meeting_room: "meeting room",
};

const DEMO: Workspace[] = [
  { name: "Coworking próximo", type: "coworking", distanceM: 850 },
  { name: "Café de trabalho", type: "cafe", distanceM: 400 },
  { name: "Sala de reunião", type: "meeting_room", distanceM: 1200 },
];

/** Busca espaços de trabalho num raio (m) ao redor do imóvel. */
export async function findNearbyWorkspaces(params: {
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<Workspace[]> {
  if (!isPlacesConfigured()) return DEMO;

  const radius = params.radiusM ?? 2000;
  const out: Workspace[] = [];

  for (const type of Object.keys(TYPE_QUERY) as WorkspaceType[]) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${params.lat},${params.lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("keyword", TYPE_QUERY[type]);
    url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY!);

    try {
      const res = await fetch(url.toString());
      const data = (await res.json()) as {
        results?: { name: string; geometry?: { location: { lat: number; lng: number } } }[];
      };
      (data.results ?? []).slice(0, 3).forEach((r) => {
        const loc = r.geometry?.location;
        const distanceM = loc
          ? Math.round(haversine(params.lat, params.lng, loc.lat, loc.lng))
          : radius;
        out.push({ name: r.name, type, distanceM });
      });
    } catch {
      // ignora falha por tipo — segue com o que conseguiu
    }
  }

  return out.length > 0 ? out : DEMO;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
