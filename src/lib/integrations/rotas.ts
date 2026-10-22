/**
 * Tempo de deslocamento (prompt 37) — UMA interface para os provedores. SERVER-ONLY.
 *
 * • Carro, a pé e bicicleta: Mapbox Matrix (perfis driving, walking, cycling), 1 destino + até 24 imóveis por chamada
 *   (25 coordenadas), em lotes. Token: MAPBOX_SERVER_TOKEN, ou o NEXT_PUBLIC_MAPBOX_TOKEN que o site já usa.
 * • Ônibus: só com dado de verdade — Google Routes (TRANSIT), atrás de ROTAS_ONIBUS_ATIVO=on e GOOGLE_ROUTES_API_KEY.
 *   Sem linha encontrada, o resultado é null e "Ônibus" não aparece.
 * • Laboratório (INTEGRACOES_SIMULADAS=on): nada sai para a rede; as chamadas vão ao rotas-falso
 *   (scripts/lab/rotas-falso.mjs, em LAB_ROTAS_URL), que responde no formato dos dois provedores.
 * • Sem provedor (sem token, chave desligada ou falha): quem chama cai para a distância em linha reta — nunca minutos
 *   inventados (src/lib/data/tempos.ts).
 *
 * As origens são SEMPRE o ponto exato do imóvel (lido pelo servidor); nada daqui vai à tela sem arredondar.
 */
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { emLotes, provedorNoAmbiente, type ModoRota, type Ponto } from "@/lib/rotas/tempo";

export interface Origem extends Ponto {
  id: string;
}
export interface TempoBruto {
  id: string;
  /** null = sem rota (ex.: ônibus sem linha). */
  minutos: number | null;
  metros: number | null;
}

export class ProvedorRotasIndisponivel extends Error {
  constructor(motivo: string) {
    super(`Provedor de rotas indisponível: ${motivo}`);
    this.name = "ProvedorRotasIndisponivel";
  }
}

const PERFIL_MAPBOX: Record<Exclude<ModoRota, "onibus">, string> = { carro: "driving", a_pe: "walking", bicicleta: "cycling" };
/** A Matrix de transporte público do Google aceita até 100 elementos por chamada. */
const ORIGENS_POR_CHAMADA_ONIBUS = 100;

const tokenMapbox = () => process.env.MAPBOX_SERVER_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const urlFalsa = () => (integracoesSimuladas() ? process.env.LAB_ROTAS_URL || "" : "");
export const onibusLigado = () => process.env.ROTAS_ONIBUS_ATIVO === "on";

/** Há provedor para este meio? (No laboratório, só com o rotas-falso no ar.) */
export function provedorDisponivel(modo: ModoRota): boolean {
  return provedorNoAmbiente(process.env, modo, integracoesSimuladas());
}

/** Meios oferecidos na tela: ônibus só com a chave ligada. */
export function modosDisponiveis(): ModoRota[] {
  return onibusLigado() ? ["carro", "a_pe", "bicicleta", "onibus"] : ["carro", "a_pe", "bicicleta"];
}

async function matrixMapbox(origens: Origem[], destino: Ponto, modo: Exclude<ModoRota, "onibus">): Promise<TempoBruto[]> {
  const base = urlFalsa() || "https://api.mapbox.com";
  const coords = [destino, ...origens].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const sources = origens.map((_, i) => i + 1).join(";");
  const url =
    `${base}/directions-matrix/v1/mapbox/${PERFIL_MAPBOX[modo]}/${coords}` +
    `?sources=${sources}&destinations=0&annotations=duration,distance&access_token=${encodeURIComponent(tokenMapbox() || "lab")}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new ProvedorRotasIndisponivel(`Mapbox ${res.status}`);
  const j = (await res.json()) as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
  if (j.code !== "Ok" || !j.durations) throw new ProvedorRotasIndisponivel(`Mapbox ${j.code ?? "sem resposta"}`);
  return origens.map((o, i) => {
    const s = j.durations?.[i]?.[0];
    const m = j.distances?.[i]?.[0];
    return { id: o.id, minutos: s == null ? null : Math.round((s / 60) * 10) / 10, metros: m == null ? null : Math.round(m) };
  });
}

async function matrixOnibus(origens: Origem[], destino: Ponto): Promise<TempoBruto[]> {
  const base = urlFalsa() || "https://routes.googleapis.com";
  const ponto = (p: Ponto) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  const res = await fetch(`${base}/distanceMatrix/v2:computeRouteMatrix`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_ROUTES_API_KEY || "lab",
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
    },
    body: JSON.stringify({ origins: origens.map(ponto), destinations: [ponto(destino)], travelMode: "TRANSIT" }),
  });
  if (!res.ok) throw new ProvedorRotasIndisponivel(`Google Routes ${res.status}`);
  const linhas = (await res.json()) as { originIndex?: number; duration?: string; distanceMeters?: number; condition?: string }[];
  const porOrigem = new Map(linhas.map((l) => [l.originIndex ?? 0, l]));
  return origens.map((o, i) => {
    const l = porOrigem.get(i);
    const seg = l?.condition === "ROUTE_EXISTS" && l.duration ? Number.parseFloat(l.duration) : NaN;
    return Number.isFinite(seg)
      ? { id: o.id, minutos: Math.round((seg / 60) * 10) / 10, metros: l?.distanceMeters ?? null }
      : { id: o.id, minutos: null, metros: null };
  });
}

/** Tempos de cada origem até o destino, no meio pedido. Lança ProvedorRotasIndisponivel se não houver provedor. */
export async function calcularTempos(origens: Origem[], destino: Ponto, modo: ModoRota): Promise<TempoBruto[]> {
  if (origens.length === 0) return [];
  if (!provedorDisponivel(modo)) throw new ProvedorRotasIndisponivel(modo === "onibus" ? "ônibus desligado" : "sem token");
  const lotes = modo === "onibus" ? emLotes(origens, ORIGENS_POR_CHAMADA_ONIBUS + 1) : emLotes(origens);
  const out: TempoBruto[] = [];
  for (const lote of lotes) {
    out.push(...(modo === "onibus" ? await matrixOnibus(lote, destino) : await matrixMapbox(lote, destino, modo)));
  }
  if (integracoesSimuladas()) await registrarSimulado("rotas", { modo, origens: origens.length, chamadas: lotes.length });
  return out;
}
