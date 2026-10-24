import "server-only";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { calcularTempos, provedorDisponivel } from "@/lib/integrations/rotas";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { OVERPASS_SERVIDORES, consultaOverpass, distanciaMetros, escolherProximidades, tentativasNominatim, type LugarProximo } from "@/lib/proximidades/osm";

/*
  PERTO-B — o caminho do servidor até o OpenStreetMap, usado pela rota /api/proximidades (busca do cadastro e da
  edição) e pelo salvamento do anúncio (endereço do lugar manual). Política de uso do OSM: User-Agent com o nome da
  Viva e o e-mail de contato, NO MÁXIMO 1 pedido por segundo (fila nesta instância) e cache por CEP (quem chama).
  Cada etapa registra no log SÓ o resultado ("nominatim:200:vazio", "overpass:429"), nunca endereço nem CEP.
*/

const USER_AGENT = `VivaNomads/1.0 (+${SITE_URL}; ${SUPORTE_EMAIL})`;

let proximoSlot = 0;
async function aguardarVez(): Promise<void> {
  const agora = Date.now();
  const espera = Math.max(0, proximoSlot - agora);
  proximoSlot = Math.max(agora, proximoSlot) + 1000;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

export type Ponto = { lat: number; lng: number };
export type FonteProximidades = "osm" | "mapbox" | "sem_ponto" | "sem_lugares" | "limite" | "cache" | "lab";

async function nominatim(params: URLSearchParams, etapas: string[]): Promise<Ponto | null> {
  await aguardarVez();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      etapas.push(`nominatim:${res.status}`);
      return null;
    }
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    etapas.push(`nominatim:200:${ok ? "ponto" : "vazio"}`);
    return ok ? { lat, lng } : null;
  } catch (e) {
    etapas.push(`nominatim:erro:${(e as Error).name}`);
    return null;
  }
}

/** Ponto do endereço: as tentativas do Nominatim (estruturada → larga) e, sem resultado, o Mapbox (só com token). */
export async function geocodificarEndereco(e: { rua?: string; numero?: string; cidade?: string; uf?: string; cep?: string }, etapas: string[] = []): Promise<{ ponto: Ponto | null; fonte: "osm" | "mapbox" | null }> {
  for (const t of tentativasNominatim(e)) {
    const p = await nominatim(t, etapas);
    if (p) return { ponto: p, fonte: "osm" };
  }
  const g = await geocodeForSave({ street: [e.rua, e.numero].filter(Boolean).join(", "), neighborhood: "", city: e.cidade ?? "" }).catch(() => null);
  if (g && !g.approximate) {
    etapas.push("mapbox:ponto");
    return { ponto: { lat: g.lat, lng: g.lng }, fonte: "mapbox" };
  }
  etapas.push("mapbox:sem_token_ou_vazio");
  return { ponto: null, fonte: null };
}

/** Ponto de um LUGAR (manual): o endereço digitado do lugar, na cidade do anúncio. */
export async function geocodificarLugar(endereco: string, cidade: string, uf: string, etapas: string[] = []): Promise<Ponto | null> {
  const q = [endereco.trim(), cidade.trim(), uf.trim(), "Brasil"].filter(Boolean).join(", ");
  const p = await nominatim(new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", q }), etapas);
  if (p) return p;
  const g = await geocodeForSave({ street: endereco, neighborhood: "", city: cidade }).catch(() => null);
  return g && !g.approximate ? { lat: g.lat, lng: g.lng } : null;
}

/** Lugares num raio de 2 km: o Overpass principal e, se ele recusar ou não responder, o espelho público. */
export async function buscarLugares(ponto: Ponto, etapas: string[] = []): Promise<LugarProximo[] | null> {
  for (const url of OVERPASS_SERVIDORES) {
    await aguardarVez();
    const nome = new URL(url).hostname;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(consultaOverpass(ponto.lat, ponto.lng))}`,
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!res.ok) {
        etapas.push(`${nome}:${res.status}`);
        continue;
      }
      const itens = escolherProximidades(await res.json(), ponto);
      etapas.push(`${nome}:200:${itens.length}`);
      return itens;
    } catch (e) {
      etapas.push(`${nome}:erro:${(e as Error).name}`);
    }
  }
  return null;
}

/**
 * Tempo pelo motor de rotas do Prompt 37 (a pé até 1 km, de carro acima). Sem provedor ou com falha: null — a tela
 * fica com a distância. Nunca minuto estimado por fórmula.
 */
export async function temposDosLugares(origem: Ponto, lugares: { id: string; lat: number; lng: number; distanciaM: number }[]): Promise<Map<string, { minutos: number; modo: "a_pe" | "carro" }>> {
  const out = new Map<string, { minutos: number; modo: "a_pe" | "carro" }>();
  for (const modo of ["a_pe", "carro"] as const) {
    const grupo = lugares.filter((l) => (modo === "a_pe" ? l.distanciaM <= 1000 : l.distanciaM > 1000));
    if (!grupo.length || !provedorDisponivel(modo)) continue;
    try {
      // Matrix: várias origens para um destino — o tempo do lugar até o imóvel (mesma rua nos dois sentidos).
      const r = await calcularTempos(grupo.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng })), origem, modo);
      for (const t of r) if (t.minutos != null) out.set(t.id, { minutos: t.minutos, modo });
    } catch {
      /* sem provedor: fica a distância */
    }
  }
  return out;
}

export { distanciaMetros };
