import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProperties } from "@/lib/data/properties";
import { ipHash } from "@/lib/limites";
import { destinoDaUrl } from "@/lib/rotas/destino-url";
import { montarResposta } from "@/lib/rotas/resposta";
import { calcularTempos, contarBuscaDestino, modosAtivos, pontosExatos, resolverDestino } from "@/lib/data/tempos-servidor";

/*
  POST /api/tempos (Prompt 37) — tempo de cada imóvel ativo até o destino da busca.
  Corpo: { destino?: "hc-ufu" } ou { dlat, dlng, drot } + { modo, contar? }.
  Resposta: só minutos ARREDONDADOS, a linha reta da coordenada aproximada e a posição por tempo — nunca lat/lng do
  imóvel nem metros (ver src/lib/rotas/resposta.ts). Cálculo novo: os 40 mais próximos, dentro do limite por IP
  (300 cálculos/hora); acima disso ou com o provedor fora, a tela mostra "em linha reta".
*/
export const dynamic = "force-dynamic";

const semCache = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400, headers: semCache });
  }
  const sp = new URLSearchParams();
  for (const k of ["destino", "dlat", "dlng", "drot", "modo", "ate"]) {
    const v = corpo[k];
    if (typeof v === "string" || typeof v === "number") sp.set(k, String(v).slice(0, 120));
  }
  const pedido = destinoDaUrl(sp);
  if (!pedido) return NextResponse.json({ ok: false, error: "Destino inválido." }, { status: 400, headers: semCache });
  const destino = await resolverDestino(pedido);
  if (!destino) return NextResponse.json({ ok: false, error: "Destino não encontrado." }, { status: 404, headers: semCache });

  // Imóveis da busca pública (coordenada APROXIMADA, inclusive os exemplos) — a linha reta usa só esta.
  const publicos = await listProperties();
  const admin = createAdminClient();
  const modoComDado = modosAtivos().includes(pedido.modo);
  let r: Awaited<ReturnType<typeof calcularTempos>> = { tempos: new Map(), fonte: "linha_reta", pendentes: new Set(), novos: 0 };
  if (admin && modoComDado) {
    const exatos = await pontosExatos(admin, publicos.map((p) => p.id));
    r = await calcularTempos({ admin, destino, modo: pedido.modo, imoveis: exatos, chaveLimite: `rotas:${ipHash(request)}` });
    // Endereço digitado: só os 40 mais próximos são calculados (o resto fica na linha reta, sem "calculando…").
    if (!destino.destino) r.pendentes.clear();
    if (corpo.contar === true && destino.destino) await contarBuscaDestino(admin, destino.destino.id);
  }
  const resposta = montarResposta({
    modo: pedido.modo,
    destino: { rotulo: destino.rotulo, artigo: destino.artigo, ponto: destino.ponto },
    fonte: r.fonte,
    imoveis: publicos,
    tempos: r.tempos,
    pendentes: r.fonte === "rotas" ? r.pendentes : new Set(),
  });
  return NextResponse.json(resposta, { headers: semCache });
}
