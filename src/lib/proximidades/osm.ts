/*
  Proximidades automáticas pelo OpenStreetMap (prompt 10, etapa 1) — regras PURAS.

  O servidor geocodifica o endereço no Nominatim e busca no Overpass, num raio de 2 km: hospital, universidade,
  mercado, farmácia, academia, parada de ônibus e coworking. Aqui ficam a consulta, a leitura da resposta, a
  distância, o tempo estimado (a pé até 1 km, de carro acima) e a escolha dos até 8 itens mais úteis.
  Política de uso do OSM: User-Agent identificando a Viva e o e-mail de contato, no máximo 1 pedido por segundo e
  cache por CEP (src/app/api/proximidades/route.ts). O ponto exato nunca é público.
*/
import type { Proximity, ProximityCategory } from "../types.ts";

export const RAIO_METROS = 2000;
export const MAX_ITENS = 8;
/** Até 1 km o tempo é a pé (~80 m/min); acima, de carro na cidade (~25 km/h ≈ 420 m/min). */
export const LIMITE_A_PE_M = 1000;
const M_POR_MIN_A_PE = 80;
const M_POR_MIN_CARRO = 420;

export type TipoLugar = "hospital" | "universidade" | "mercado" | "farmacia" | "academia" | "onibus" | "coworking";

export const TIPOS_LUGAR: readonly { tipo: TipoLugar; rotulo: string; categoria: ProximityCategory; filtros: string[] }[] = [
  { tipo: "hospital", rotulo: "Hospital", categoria: "saude", filtros: ['["amenity"="hospital"]'] },
  { tipo: "universidade", rotulo: "Universidade", categoria: "educacao", filtros: ['["amenity"="university"]', '["amenity"="college"]'] },
  { tipo: "mercado", rotulo: "Mercado", categoria: "mercado", filtros: ['["shop"="supermarket"]'] },
  { tipo: "farmacia", rotulo: "Farmácia", categoria: "saude", filtros: ['["amenity"="pharmacy"]'] },
  { tipo: "academia", rotulo: "Academia", categoria: "saude", filtros: ['["leisure"="fitness_centre"]'] },
  { tipo: "onibus", rotulo: "Parada de ônibus", categoria: "transporte", filtros: ['["highway"="bus_stop"]'] },
  { tipo: "coworking", rotulo: "Coworking", categoria: "trabalho", filtros: ['["amenity"="coworking_space"]', '["office"="coworking"]'] },
];

export interface LugarProximo {
  tipo: TipoLugar;
  categoria: ProximityCategory;
  nome: string;
  distanciaM: number;
  /** "8 min a pé" / "6 min de carro". */
  tempo: string;
}

/** Distância em metros entre dois pontos (haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Tempo estimado: a pé até 1 km, de carro acima disso (mínimo 1 min). */
export function tempoEstimado(distanciaM: number): string {
  if (distanciaM <= LIMITE_A_PE_M) return `${Math.max(1, Math.round(distanciaM / M_POR_MIN_A_PE))} min a pé`;
  return `${Math.max(1, Math.round(distanciaM / M_POR_MIN_CARRO))} min de carro`;
}

/** Consulta Overpass QL: os 7 tipos num raio de 2 km do ponto, com centro dos polígonos. */
export function consultaOverpass(lat: number, lng: number, raio = RAIO_METROS): string {
  const linhas = TIPOS_LUGAR.flatMap((t) =>
    t.filtros.flatMap((f) => [`node${f}(around:${raio},${lat},${lng});`, `way${f}(around:${raio},${lat},${lng});`]),
  );
  return `[out:json][timeout:20];(${linhas.join("")});out center 200;`;
}

interface ElementoOverpass {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function tipoDasTags(tags: Record<string, string>): TipoLugar | null {
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "university" || tags.amenity === "college") return "universidade";
  if (tags.shop === "supermarket") return "mercado";
  if (tags.amenity === "pharmacy") return "farmacia";
  if (tags.leisure === "fitness_centre") return "academia";
  if (tags.highway === "bus_stop") return "onibus";
  if (tags.amenity === "coworking_space" || tags.office === "coworking") return "coworking";
  return null;
}

/** Nome limpo (sem tags HTML, até 80 caracteres); parada sem nome vira "Parada de ônibus". */
function nomeDoLugar(tags: Record<string, string>, tipo: TipoLugar): string | null {
  const bruto = (tags.name ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (bruto) return bruto;
  return tipo === "onibus" ? "Parada de ônibus" : null;
}

/**
 * Lê a resposta do Overpass e escolhe até 8 lugares: o mais perto de cada tipo primeiro (na ordem da lista), depois
 * o segundo mais perto dos tipos com mais opções, até completar. Sem nome (exceto parada) fica de fora.
 */
export function escolherProximidades(resposta: unknown, origem: { lat: number; lng: number }): LugarProximo[] {
  const elementos = (resposta as { elements?: ElementoOverpass[] } | null)?.elements;
  if (!Array.isArray(elementos)) return [];
  const porTipo = new Map<TipoLugar, LugarProximo[]>();
  const vistos = new Set<string>();
  for (const e of elementos) {
    const tags = e.tags ?? {};
    const tipo = tipoDasTags(tags);
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!tipo || typeof lat !== "number" || typeof lng !== "number") continue;
    const nome = nomeDoLugar(tags, tipo);
    if (!nome) continue;
    const distanciaM = distanciaMetros(origem, { lat, lng });
    if (distanciaM > RAIO_METROS) continue;
    const chave = `${tipo}|${nome.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const meta = TIPOS_LUGAR.find((t) => t.tipo === tipo)!;
    const lista = porTipo.get(tipo) ?? [];
    lista.push({ tipo, categoria: meta.categoria, nome, distanciaM, tempo: tempoEstimado(distanciaM) });
    porTipo.set(tipo, lista);
  }
  for (const l of porTipo.values()) l.sort((a, b) => a.distanciaM - b.distanciaM);

  const escolhidos: LugarProximo[] = [];
  for (let rodada = 0; escolhidos.length < MAX_ITENS; rodada++) {
    let algum = false;
    for (const t of TIPOS_LUGAR) {
      const l = porTipo.get(t.tipo);
      if (l && l[rodada] && escolhidos.length < MAX_ITENS) {
        escolhidos.push(l[rodada]);
        algum = true;
      }
    }
    if (!algum) break;
  }
  return escolhidos;
}

/** Converte para o formato salvo em property_proximities (o mesmo das proximidades manuais). */
export function paraProximity(l: LugarProximo): Proximity {
  return { category: l.categoria, name: l.nome, note: l.tempo };
}

/** CEP com 8 dígitos (ou null). */
export function cepValido(cep: unknown): string | null {
  const d = String(cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

/** Endereço para o Nominatim (sem complemento: não ajuda a achar e é dado do dono). */
export function consultaNominatim(e: { rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string }): string {
  const rua = [e.rua, e.numero].map((s) => s?.trim()).filter(Boolean).join(", ");
  return [rua, e.bairro, e.cidade, e.uf, e.cep, "Brasil"].map((s) => s?.trim()).filter(Boolean).join(", ");
}

/** Proximidades fixas do laboratório (sempre simulado: nada sai para a rede). */
export const PROXIMIDADES_LAB: LugarProximo[] = [
  { tipo: "hospital", categoria: "saude", nome: "Hospital de Clínicas (exemplo do laboratório)", distanciaM: 1800, tempo: tempoEstimado(1800) },
  { tipo: "universidade", categoria: "educacao", nome: "Campus Santa Mônica (exemplo do laboratório)", distanciaM: 1200, tempo: tempoEstimado(1200) },
  { tipo: "mercado", categoria: "mercado", nome: "Supermercado do Bairro (exemplo do laboratório)", distanciaM: 350, tempo: tempoEstimado(350) },
  { tipo: "farmacia", categoria: "saude", nome: "Farmácia Central (exemplo do laboratório)", distanciaM: 220, tempo: tempoEstimado(220) },
  { tipo: "academia", categoria: "saude", nome: "Academia Movimento (exemplo do laboratório)", distanciaM: 640, tempo: tempoEstimado(640) },
  { tipo: "onibus", categoria: "transporte", nome: "Parada de ônibus", distanciaM: 90, tempo: tempoEstimado(90) },
  { tipo: "coworking", categoria: "trabalho", nome: "Coworking Centro (exemplo do laboratório)", distanciaM: 900, tempo: tempoEstimado(900) },
];
