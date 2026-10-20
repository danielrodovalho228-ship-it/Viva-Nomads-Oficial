import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProperty } from "@/lib/data/properties";
import { ipHash } from "@/lib/limites";
import { destinoDaUrl } from "@/lib/rotas/destino-url";
import { blocoTempoAte, type LinhaTempoAte } from "@/lib/rotas/tempo-ate";
import { distanciaKm, temCoordenada } from "@/lib/rotas/selecao";
import { calcularTempos, listarDestinosAtivos, modosAtivos, pontosExatos, resolverCadastrado, resolverDestino, type DestinoResolvido } from "@/lib/data/tempos-servidor";
import type { Modo } from "@/lib/rotas/tempo";

/*
  GET /api/tempos/imovel?id=… [&destino=hc-ufu | &dlat&dlng&drot] (Prompt 37) — bloco "Tempo até" da página do imóvel:
  o destino da busca (se veio dela) + os 3 destinos cadastrados mais próximos, de carro e a pé (e ônibus com a chave
  ligada). Só minutos arredondados e a linha reta da coordenada aproximada; nunca o ponto do imóvel.
*/
export const dynamic = "force-dynamic";

const semCache = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const id = sp.get("id") ?? "";
  const imovel = id ? await getProperty(id) : undefined;
  if (!imovel) return NextResponse.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404, headers: semCache });

  const destinos: DestinoResolvido[] = [];
  const daBusca = destinoDaUrl(sp);
  if (daBusca) {
    const d = await resolverDestino(daBusca);
    if (d) destinos.push(d);
  }
  const ativos = await listarDestinosAtivos();
  const pertos = temCoordenada(imovel)
    ? ativos
        .filter((d) => !destinos.some((x) => x.destino?.id === d.id))
        .map((d) => ({ d, km: distanciaKm(imovel, d) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
        .map(({ d }) => resolverCadastrado(d))
    : [];
  destinos.push(...pertos);

  const modos = (["carro", "a_pe", "onibus"] as Modo[]).filter((m) => modosAtivos().includes(m));
  const admin = createAdminClient();
  const exato = admin ? (await pontosExatos(admin, [imovel.id]))[0] : undefined;
  const linhas: LinhaTempoAte[] = [];
  for (const d of destinos) {
    const minutos: Partial<Record<Modo, number | null>> = {};
    for (const modo of modos) {
      if (!admin || !exato) break;
      const r = await calcularTempos({ admin, destino: d, modo, imoveis: [exato], chaveLimite: `rotas:${ipHash(request)}` });
      minutos[modo] = r.tempos.get(exato.id)?.minutos ?? null;
    }
    linhas.push(blocoTempoAte({ destino: d, imovelAproximado: imovel, modos, minutos }));
  }
  return NextResponse.json({ ok: true, linhas }, { headers: semCache });
}
