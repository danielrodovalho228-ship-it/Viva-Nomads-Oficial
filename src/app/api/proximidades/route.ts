import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import {
  cepValido,
  consultaNominatim,
  consultaOverpass,
  escolherProximidades,
  PROXIMIDADES_LAB,
  type LugarProximo,
} from "@/lib/proximidades/osm";

/*
  Ponto no mapa + proximidades automáticas da etapa 1 do cadastro (prompt 10).
  • Nominatim (geocodificação) e Overpass (lugares num raio de 2 km), do OpenStreetMap, sem custo.
  • Política de uso do OSM: User-Agent com o nome da Viva e o e-mail de contato, NO MÁXIMO 1 pedido por segundo
    (fila neste servidor) e cache por CEP (tabela proximidades_cep, só o servidor lê e grava).
  • Mapbox como reserva da geocodificação (quando houver token). Se tudo falhar, devolve lista vazia: a etapa
    segue com "Adicionar" manual, sem travar.
  • O ponto exato NUNCA vai ao anúncio (vale o círculo do bairro); aqui ele só serve para achar os lugares.
  • Laboratório (INTEGRACOES_SIMULADAS=on): sempre a lista fixa, nada sai para a rede.
*/

const USER_AGENT = `VivaNomads/1.0 (+${SITE_URL}; ${SUPORTE_EMAIL})`;
const CACHE_DIAS = 30;

// Fila de 1 pedido por segundo ao OSM (por instância do servidor; o cache por CEP evita a maior parte).
let proximoSlot = 0;
async function aguardarVez(): Promise<void> {
  const agora = Date.now();
  const espera = Math.max(0, proximoSlot - agora);
  proximoSlot = Math.max(agora, proximoSlot) + 1000;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

async function geocodificar(q: string): Promise<{ lat: number; lng: number } | null> {
  await aguardarVez();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function lugares(lat: number, lng: number): Promise<LugarProximo[]> {
  await aguardarVez();
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(consultaOverpass(lat, lng))}`,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    return escolherProximidades(await res.json(), { lat, lng });
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ itens: [], fonte: "demo" });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "");
  const cep = cepValido(corpo?.cep);
  if (!cep) return NextResponse.json({ error: "CEP inválido." }, { status: 400 });

  if (integracoesSimuladas()) {
    await registrarSimulado("osm", { acao: "proximidades", cep });
    return NextResponse.json({ itens: PROXIMIDADES_LAB, fonte: "lab" });
  }

  const admin = createAdminClient();
  if (admin) {
    const { data: cache } = await admin.from("proximidades_cep").select("itens, atualizado_em").eq("cep", cep).maybeSingle();
    const fresco = cache && Date.now() - Date.parse(cache.atualizado_em as string) < CACHE_DIAS * 86_400_000;
    if (fresco && Array.isArray(cache.itens) && cache.itens.length > 0) {
      return NextResponse.json({ itens: cache.itens, fonte: "cache" });
    }
  }

  // OSM é gratuito, mas é de todos: limita por pessoa além do cache.
  if (!(await consumirLimite(`osm:${user.id}`, 30, DIA))) {
    return NextResponse.json({ itens: [], fonte: "limite" });
  }

  const endereco = {
    rua: s(corpo?.rua, 150),
    numero: s(corpo?.numero, 20),
    bairro: s(corpo?.bairro, 100),
    cidade: s(corpo?.cidade, 100),
    uf: s(corpo?.uf, 2),
    cep,
  };
  let ponto = await geocodificar(consultaNominatim(endereco));
  let fonte = "osm";
  if (!ponto) {
    // Reserva: Mapbox (só com token); o centro da cidade aproximado não serve para proximidades.
    const g = await geocodeForSave({ street: [endereco.rua, endereco.numero].filter(Boolean).join(", "), neighborhood: endereco.bairro, city: endereco.cidade });
    if (!g.approximate) {
      ponto = { lat: g.lat, lng: g.lng };
      fonte = "mapbox";
    }
  }
  if (!ponto) return NextResponse.json({ itens: [], fonte: "sem_ponto" });

  const itens = await lugares(ponto.lat, ponto.lng);
  if (admin && itens.length > 0) {
    await admin
      .from("proximidades_cep")
      .upsert({ cep, lat: ponto.lat, lng: ponto.lng, itens, fonte, atualizado_em: new Date().toISOString() });
  }
  return NextResponse.json({ itens, fonte });
}
