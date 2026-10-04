import { NextResponse } from "next/server";
import { resolveProximities } from "@/lib/integrations/google-places";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";

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
    // A5: no máximo 15 lugares por chamada e 60 chamadas/hora por IP (a página
    // pública do imóvel chama sem login; cada lugar é uma consulta paga).
    const places = Array.isArray(body?.places) ? body.places.slice(0, 15) : [];
    if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
      return NextResponse.json({ places: [] });
    }
    if (places.length === 0) return NextResponse.json({ places: [] });
    if (!(await consumirLimite(`places:dist:ip:${ipHash(request)}`, 60, HORA))) {
      return NextResponse.json({ places: [] }, { status: 429 });
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
