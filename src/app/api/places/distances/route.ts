import { NextResponse } from "next/server";
import { resolveProximities } from "@/lib/integrations/google-places";

/**
 * Resolve nome + distância em tempo real das proximidades de um imóvel
 * (servidor — chave do Google protegida). Recebe a origem (coords do imóvel) e a
 * lista curada de { placeId, categoria, rotulo }. Sem chave/erro → fallback
 * (nome = rótulo, sem distância), nunca 500.
 *
 * POST /api/places/distances  body: { origin:{lat,lng}, places:[{placeId,categoria,rotulo}] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = body?.origin;
    const places = Array.isArray(body?.places) ? body.places : [];
    if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
      return NextResponse.json({ places: [] });
    }
    const resolved = await resolveProximities(origin, places);
    // Cache curto na borda/CDN (sem persistir no banco — regra do Google).
    return NextResponse.json(
      { places: resolved },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch {
    return NextResponse.json({ places: [] });
  }
}
