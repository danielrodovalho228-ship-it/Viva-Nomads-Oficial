import { NextResponse } from "next/server";
import { placesAutocomplete } from "@/lib/integrations/google-places";

/**
 * Autocomplete de lugares (servidor — a chave do Google não vai ao browser).
 * GET /api/places/autocomplete?q=ASA&lat=-18.9&lng=-48.2
 * Sem GOOGLE_MAPS_API_KEY → devolve lista vazia (a UI mostra "configure a chave").
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  const suggestions = await placesAutocomplete(q, center);
  return NextResponse.json({ suggestions });
}
