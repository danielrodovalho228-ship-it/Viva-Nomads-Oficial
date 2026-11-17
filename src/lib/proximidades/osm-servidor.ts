import "server-only";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { calcularTempos, provedorDisponivel } from "@/lib/integrations/rotas";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { TENTATIVAS_NOMINATIM, ESPERA_NOMINATIM_MS, comRodizio, planoOverpass, repetivel, retryAfterMs, type ResultadoTentativa } from "@/lib/proximidades/tentativas-osm";
import { OVERPASS_SERVIDORES, consultaOverpass, distanciaMetros, escolherProximidades, overpassFalhou, tentativasNominatim, type LugarProximo } from "@/lib/proximidades/osm";

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
/** E259: "erro" = o Overpass não respondeu (os dois servidores); a tela diz "não respondeu", nunca "nada por perto". */
export type FonteProximidades = "osm" | "mapbox" | "sem_ponto" | "sem_lugares" | "limite" | "cache" | "lab" | "erro";

async function nominatim(params: URLSearchParams, etapas: string[]): Promise<Ponto | null> {
  // E992: 429/5xx/tempo estourado repete uma vez (2 s depois, e ainda na fila de 1 pedido/s); 200 vazio não se repete.
  for (let t = 1; t <= TENTATIVAS_NOMINATIM; t++) {
    if (t > 1) await new Promise((r) => setTimeout(r, ESPERA_NOMINATIM_MS));
    await aguardarVez();
    let falha: ResultadoTentativa;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const [hit] = (await res.json()) as { lat: string; lon: string }[];
        const lat = Number(hit?.lat);
        const lng = Number(hit?.lon);
        const ok = Number.isFinite(lat) && Number.isFinite(lng);
        etapas.push(`nominatim:200:${ok ? "ponto" : "vazio"}`);
        return ok ? { lat, lng } : null;
      }
      etapas.push(`nominatim:${res.status}`);
      falha = { status: res.status };
    } catch (e) {
      etapas.push(`nominatim:erro:${(e as Error).name}`);
      falha = { erro: (e as Error).name };
    }
    if (!repetivel(falha)) return null;
  }
  return null;
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

/**
 * E992: o ponto SÓ do Nominatim (OSM), para a lista que se GUARDA — sem o recurso ao Mapbox (nada do Mapbox no
 * armazenamento). null = o OSM não achou o endereço: a perna não grava nada (falha honesta).
 */
export async function geocodificarEnderecoOsm(e: { rua?: string; numero?: string; cidade?: string; uf?: string; cep?: string }, etapas: string[] = []): Promise<Ponto | null> {
  for (const t of tentativasNominatim(e)) {
    const p = await nominatim(t, etapas);
    if (p) return p;
  }
  return null;
}

/** Ponto de um LUGAR (manual): o endereço digitado do lugar, na cidade do anúncio. */
export async function geocodificarLugar(endereco: string, cidade: string, uf: string, etapas: string[] = []): Promise<Ponto | null> {
  const q = [endereco.trim(), cidade.trim(), uf.trim(), "Brasil"].filter(Boolean).join(", ");
  const p = await nominatim(new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", q }), etapas);
  if (p) return p;
  const g = await geocodeForSave({ street: endereco, neighborhood: "", city: cidade }).catch(() => null);
  return g && !g.approximate ? { lat: g.lat, lng: g.lng } : null;
}

/**
 * Lugares num raio de 2 km. E992: rodízio entre os servidores do Overpass, em rodadas com espera crescente (ou o
 * Retry-After), dentro de um orçamento de tempo; 400/403/404 tira aquele servidor da roda. Esgotado: null (a tela diz
 * "não respondeu"; nada de lista vazia gravada).
 */
export async function buscarLugares(ponto: Ponto, etapas: string[] = [], orcamentoMs?: number): Promise<LugarProximo[] | null> {
  const corpo = `data=${encodeURIComponent(consultaOverpass(ponto.lat, ponto.lng))}`;
  return comRodizio<LugarProximo[]>(
    planoOverpass(OVERPASS_SERVIDORES),
    async (url, tempoMs) => {
      await aguardarVez();
      const nome = new URL(url).hostname;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
          body: corpo,
          signal: AbortSignal.timeout(tempoMs),
          cache: "no-store",
        });
        if (!res.ok) {
          etapas.push(`${nome}:${res.status}`);
          return { falha: { status: res.status }, retryAfterMs: retryAfterMs(res.headers.get("retry-after")) };
        }
        const json = await res.json();
        // E259: 200 com "remark" de erro e nada nos elementos é tempo estourado — conta como falha que se repete.
        if (overpassFalhou(json)) {
          etapas.push(`${nome}:200:remark`);
          return { falha: { remark: true } };
        }
        const itens = escolherProximidades(json, ponto);
        etapas.push(`${nome}:200:${itens.length}`);
        return { ok: itens };
      } catch (e) {
        etapas.push(`${nome}:erro:${(e as Error).name}`);
        return { falha: { erro: (e as Error).name } };
      }
    },
    etapas,
    orcamentoMs,
  );
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
