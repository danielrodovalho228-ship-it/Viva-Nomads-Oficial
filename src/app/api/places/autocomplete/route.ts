import { NextResponse } from "next/server";
import { placesAutocomplete } from "@/lib/integrations/google-places";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, ipHash, DIA, HORA } from "@/lib/limites";

/**
 * Autocomplete do Google Places (usado no editor do anúncio). A5: cada chamada
 * custa — exige login e limita por pessoa (300/dia) e por IP (120/hora).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ suggestions: [] });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 100);
  if (q.trim().length < 3) return NextResponse.json({ suggestions: [] });

  const ok =
    (await consumirLimite(`places:ac:user:${user.id}`, 300, DIA)) &&
    (await consumirLimite(`places:ac:ip:${ipHash(request)}`, 120, HORA));
  if (!ok) return NextResponse.json({ suggestions: [] }, { status: 429 });

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  const suggestions = await placesAutocomplete(q, center);
  return NextResponse.json({ suggestions });
}
