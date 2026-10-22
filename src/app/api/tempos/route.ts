import { NextResponse } from "next/server";
import { ipHash } from "@/lib/limites";
import { ehModo } from "@/lib/rotas/tempo";
import { contarBuscaDestino, resolverDestino, temposAte } from "@/lib/data/tempos";
import { sinaisDosAnuncios } from "@/lib/data/ranking";
import { ordenarBusca } from "@/lib/ranking/ordem";
import { provedorDisponivel } from "@/lib/integrations/rotas";

/**
 * Tempos até o destino da busca (prompt 37). Público, sem login.
 *
 * POST /api/tempos  body: { destino?: slug, dlat?, dlng?, drot?, modo, ids: string[], contar?: boolean }
 * Resposta: { destino, modo, reta, calculando, itens: [{ id, texto, min, pos }] } — `min` arredondado (múltiplo de 5;
 * 0 = menos de 5; null = linha reta) e `pos` = posição pela ordem da busca com faixas de minutos (33 + 37).
 * NUNCA devolve coordenada nem metros (teste de privacidade em tempos-api.test.ts).
 */
export async function POST(request: Request) {
  const vazio = (status = 200) => NextResponse.json({ itens: [], reta: true, calculando: false }, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const b = (await request.json()) as Record<string, unknown>;
    const modo = b.modo;
    if (!ehModo(modo)) return vazio(400);
    const destino = await resolverDestino({
      destino: typeof b.destino === "string" ? b.destino : null,
      dlat: b.dlat == null ? null : String(b.dlat),
      dlng: b.dlng == null ? null : String(b.dlng),
      drot: typeof b.drot === "string" ? b.drot : null,
    });
    if (!destino) return vazio(404);
    if (modo === "onibus" && !provedorDisponivel("onibus")) return vazio(404);
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 400) : [];
    if (ids.length === 0) return vazio();
    if (b.contar === true && destino.destinoId) await contarBuscaDestino(destino.destinoId);

    const r = await temposAte(destino, modo, { ids, ip: ipHash(request) });
    const minutos = new Map(r.itens.map((i) => [i.id, i.min]));
    const sinais = await sinaisDosAnuncios(r.itens.map((i) => i.id));
    const ordem = ordenarBusca(
      sinais.map((s) => ({ sinais: s, compat: "exata" as const, distanciaKm: null, minutos: minutos.get(s.id) ?? null })),
      new Date(),
      { porMinutos: true },
    );
    const pos = new Map(ordem.map((o, i) => [o.id, i]));
    return NextResponse.json(
      {
        destino: { rotulo: destino.rotulo, slug: destino.slug ?? null },
        modo,
        reta: r.reta,
        calculando: r.calculando,
        itens: r.itens.map((i) => ({ id: i.id, texto: i.texto, min: i.min, pos: pos.get(i.id) ?? null })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[api/tempos]", e);
    return vazio(500);
  }
}
