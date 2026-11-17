/*
  Proximidades automáticas pelo OpenStreetMap (prompt 10, etapa 1) — regras PURAS.

  O servidor geocodifica o endereço no Nominatim e busca no Overpass, num raio de 2 km: hospital, universidade,
  escola, mercado, farmácia, academia, parada de ônibus e coworking. Aqui ficam a consulta, a leitura da resposta, a
  distância e a escolha de até 3 por categoria, os mais próximos primeiro (PERTO-B). Tempo de deslocamento NÃO sai
  daqui: só o motor de rotas (src/lib/integrations/rotas.ts) calcula minutos; sem provedor, a tela mostra a distância.
  Política de uso do OSM: User-Agent identificando a Viva e o e-mail de contato, no máximo 1 pedido por segundo e
  cache por CEP (src/app/api/proximidades/route.ts). O ponto exato nunca é público.
*/
import type { Proximity, ProximityCategory } from "../types.ts";

export const RAIO_METROS = 2000;
/** PERTO-B: até 3 lugares por categoria (troca o teto de 8 no total). */
export const MAX_POR_CATEGORIA = 3;

export type TipoLugar = "hospital" | "universidade" | "escola" | "mercado" | "farmacia" | "academia" | "onibus" | "coworking" | "empresa";

/** Ordem fixa das categorias na tela: Saúde, Educação, Trabalho, Mercado, Transporte. */
export const ORDEM_CATEGORIAS: readonly ProximityCategory[] = ["saude", "educacao", "trabalho", "mercado", "transporte"];

export const TIPOS_LUGAR: readonly { tipo: TipoLugar; rotulo: string; categoria: ProximityCategory; filtros: string[] }[] = [
  { tipo: "hospital", rotulo: "Hospital", categoria: "saude", filtros: ['["amenity"="hospital"]'] },
  { tipo: "universidade", rotulo: "Universidade", categoria: "educacao", filtros: ['["amenity"="university"]', '["amenity"="college"]'] },
  { tipo: "escola", rotulo: "Escola", categoria: "educacao", filtros: ['["amenity"="school"]'] },
  { tipo: "mercado", rotulo: "Mercado", categoria: "mercado", filtros: ['["shop"="supermarket"]'] },
  { tipo: "farmacia", rotulo: "Farmácia", categoria: "saude", filtros: ['["amenity"="pharmacy"]'] },
  { tipo: "academia", rotulo: "Academia", categoria: "saude", filtros: ['["leisure"="fitness_centre"]'] },
  { tipo: "onibus", rotulo: "Parada de ônibus", categoria: "transporte", filtros: ['["highway"="bus_stop"]'] },
  { tipo: "coworking", rotulo: "Coworking", categoria: "trabalho", filtros: ['["amenity"="coworking_space"]', '["office"="coworking"]'] },
  // E259: só das âncoras oficiais (tabela destinos, tipo "empresa"); o OSM não busca empresa.
  { tipo: "empresa", rotulo: "Empresa", categoria: "trabalho", filtros: [] },
];

/** E259: paradas de ônibus só até 600 m — no raio de 2 km eram centenas e a consulta estourava o tempo do Overpass. */
export const RAIO_ONIBUS_METROS = 600;

export interface LugarProximo {
  tipo: TipoLugar;
  categoria: ProximityCategory;
  nome: string;
  /** Distância em linha reta do endereço ao lugar (metros). */
  distanciaM: number;
  /** Ponto do LUGAR (público), para o motor de rotas calcular o tempo. Nunca o ponto do imóvel. */
  lat?: number;
  lng?: number;
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

/** Consulta Overpass QL: os 8 tipos num raio de 2 km do ponto, com centro dos polígonos. */
export function consultaOverpass(lat: number, lng: number, raio = RAIO_METROS): string {
  const linhas = TIPOS_LUGAR.flatMap((t) =>
    t.filtros.flatMap((f) => {
      const r = t.tipo === "onibus" ? Math.min(raio, RAIO_ONIBUS_METROS) : raio;
      return [`node${f}(around:${r},${lat},${lng});`, `way${f}(around:${r},${lat},${lng});`];
    }),
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
  if (tags.amenity === "school") return "escola";
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
 * Lê a resposta do Overpass e escolhe até 3 lugares por categoria, os mais próximos primeiro, na ordem fixa das
 * categorias (Saúde, Educação, Trabalho, Mercado, Transporte). Sem nome (exceto parada) fica de fora.
 */
export function escolherProximidades(resposta: unknown, origem: { lat: number; lng: number }): LugarProximo[] {
  const elementos = (resposta as { elements?: ElementoOverpass[] } | null)?.elements;
  if (!Array.isArray(elementos)) return [];
  return escolherDosElementos(elementos, origem);
}

/**
 * E259: o Overpass responde HTTP 200 com `elements: []` e um `remark` ("runtime error: Query timed out…") quando a
 * consulta estoura o tempo. Isso é FALHA (a busca não respondeu), não "nada por perto".
 */
export function overpassFalhou(resposta: unknown): boolean {
  const r = resposta as { elements?: unknown; remark?: unknown } | null;
  if (!r || !Array.isArray(r.elements)) return true;
  return r.elements.length === 0 && typeof r.remark === "string" && /error|timed out|timeout|out of memory/i.test(r.remark);
}

function escolherDosElementos(elementos: ElementoOverpass[], origem: { lat: number; lng: number }): LugarProximo[] {
  const candidatos: CandidatoLugar[] = [];
  for (const e of elementos) {
    const tags = e.tags ?? {};
    const tipo = tipoDasTags(tags);
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!tipo || typeof lat !== "number" || typeof lng !== "number") continue;
    candidatos.push({ tipo, nome: tags.name ?? "", lat, lng });
  }
  return escolherLugares(candidatos, origem);
}

/** Um lugar achado por um provedor (Overpass ou Mapbox), antes da escolha: tipo, nome bruto e ponto do LUGAR. */
export interface CandidatoLugar {
  tipo: TipoLugar;
  nome: string;
  lat: number;
  lng: number;
}

/**
 * E978: a MESMA escolha para os dois provedores — até 3 por categoria, os mais próximos primeiro, na ordem fixa das
 * categorias; nome limpo (parada sem nome vira "Parada de ônibus"; outro lugar sem nome fica de fora), dentro do raio
 * (parada de ônibus até 600 m) e sem repetir o mesmo tipo + nome.
 */
export function escolherLugares(candidatos: readonly CandidatoLugar[], origem: { lat: number; lng: number }): LugarProximo[] {
  const porCategoria = new Map<ProximityCategory, LugarProximo[]>();
  const vistos = new Set<string>();
  for (const c of candidatos) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const nome = nomeDoLugar({ name: c.nome }, c.tipo);
    if (!nome) continue;
    const distanciaM = distanciaMetros(origem, { lat: c.lat, lng: c.lng });
    if (distanciaM > (c.tipo === "onibus" ? RAIO_ONIBUS_METROS : RAIO_METROS)) continue;
    const chave = `${c.tipo}|${nome.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const meta = TIPOS_LUGAR.find((t) => t.tipo === c.tipo)!;
    const lista = porCategoria.get(meta.categoria) ?? [];
    lista.push({ tipo: c.tipo, categoria: meta.categoria, nome, distanciaM, lat: c.lat, lng: c.lng });
    porCategoria.set(meta.categoria, lista);
  }
  return ORDEM_CATEGORIAS.flatMap((c) => (porCategoria.get(c) ?? []).sort((a, b) => a.distanciaM - b.distanciaM).slice(0, MAX_POR_CATEGORIA));
}

/**
 * E978 opção (i): a lista AUTOMÁTICA que se guarda é a do OSM do CEP (ponto do Nominatim + Overpass), não o que o
 * editor mostrou (o editor mostra o Mapbox ao vivo, que nunca é guardado). Primeiro os que o editor mandou e que
 * estão no OSM (na ordem e com o "não mostrar" do dono), depois o resto da lista do OSM, visível. Sem lista do OSM
 * (a perna falhou), nada do que o editor mandou entra.
 */
/**
 * E978 (refinamento, DUET-2005): a chave de um lugar para casar o que o editor mostrou (Mapbox) com a lista do OSM —
 * tipo + nome normalizado: sem acentos, sem diferença de caixa e com os espaços reduzidos a um ("Farmácia  São João" =
 * "farmacia sao joao"). Pontuação e palavras continuam a contar: nomes diferentes não viram o mesmo lugar.
 */
export function chaveDoLugar(tipo: string | null | undefined, nome: string): string {
  const n = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${tipo ?? ""}|${n}`;
}

export function osmParaGravar(
  enviados: readonly { tipo?: string | null; nome: string; oculto?: boolean }[],
  doCep: ReadonlyMap<string, LugarProximo>,
  listaDoCep: readonly LugarProximo[],
): { lugar: LugarProximo; oculto: boolean }[] {
  const chave = chaveDoLugar;
  const out: { lugar: LugarProximo; oculto: boolean }[] = [];
  const usados = new Set<string>();
  for (const e of enviados) {
    const k = chave(e.tipo, e.nome);
    const l = doCep.get(k);
    if (!l || usados.has(k)) continue;
    usados.add(k);
    out.push({ lugar: l, oculto: e.oculto === true });
  }
  for (const l of listaDoCep) {
    const k = chave(l.tipo, l.nome);
    if (usados.has(k)) continue;
    usados.add(k);
    out.push({ lugar: l, oculto: false });
  }
  return out;
}

/** Converte para o formato salvo em property_proximities: distância CALCULADA, sem minuto estimado. */
export function paraProximity(l: LugarProximo): Proximity {
  return { category: l.categoria, name: l.nome, tipo: l.tipo, origem: "osm", distanciaM: l.distanciaM };
}

/** CEP com 8 dígitos (ou null). */
export function cepValido(cep: unknown): string | null {
  const d = String(cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

/** PERTO-B: a busca repete sempre que o endereço muda (CEP, rua ou número); mesma chave = mesma busca. */
export function chaveBuscaPerto(cep: unknown, rua: unknown, numero: unknown): string {
  return `${cepValido(cep) ?? ""}|${String(rua ?? "").trim().toLowerCase()}|${String(numero ?? "").trim()}`;
}

/** CEP no formato que o OpenStreetMap usa no Brasil ("38400-000"). */
export function cepComHifen(cep: string): string {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/**
 * PERTO-B: as tentativas no Nominatim, da mais precisa para a mais larga. A consulta em texto único com o CEP só com
 * dígitos e o bairro quase nunca casa no OSM do Brasil — por isso a busca ESTRUTURADA (rua com número, cidade,
 * estado, CEP com hífen), depois sem o CEP, depois rua + cidade em texto e, por fim, só o CEP.
 */
export function tentativasNominatim(e: { rua?: string; numero?: string; cidade?: string; uf?: string; cep?: string }): URLSearchParams[] {
  const limpo = (v?: string) => (v ?? "").trim();
  const rua = [limpo(e.numero), limpo(e.rua)].filter(Boolean).join(" ");
  const base = { format: "jsonv2", limit: "1", countrycodes: "br" };
  const out: URLSearchParams[] = [];
  const cep = limpo(e.cep) ? cepComHifen(limpo(e.cep)) : "";
  if (rua && limpo(e.cidade)) {
    out.push(new URLSearchParams({ ...base, street: rua, city: limpo(e.cidade), ...(limpo(e.uf) ? { state: limpo(e.uf) } : {}), ...(cep ? { postalcode: cep } : {}), country: "Brasil" }));
    if (cep) out.push(new URLSearchParams({ ...base, street: rua, city: limpo(e.cidade), ...(limpo(e.uf) ? { state: limpo(e.uf) } : {}), country: "Brasil" }));
    out.push(new URLSearchParams({ ...base, q: [limpo(e.rua), limpo(e.cidade), limpo(e.uf), "Brasil"].filter(Boolean).join(", ") }));
  }
  if (cep) out.push(new URLSearchParams({ ...base, postalcode: cep, country: "Brasil" }));
  return out;
}

/** Endereço para o Nominatim (sem complemento: não ajuda a achar e é dado do dono). */
export function consultaNominatim(e: { rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string }): string {
  const rua = [e.rua, e.numero].map((s) => s?.trim()).filter(Boolean).join(", ");
  return [rua, e.bairro, e.cidade, e.uf, e.cep, "Brasil"].map((s) => s?.trim()).filter(Boolean).join(", ");
}

/** Proximidades fixas do laboratório (sempre simulado: nada sai para a rede). Distâncias fixas, sem minuto. */
export const PROXIMIDADES_LAB: LugarProximo[] = [
  { tipo: "hospital", categoria: "saude", nome: "Hospital de Clínicas (exemplo do laboratório)", distanciaM: 1800 },
  { tipo: "farmacia", categoria: "saude", nome: "Farmácia Central (exemplo do laboratório)", distanciaM: 220 },
  { tipo: "academia", categoria: "saude", nome: "Academia Movimento (exemplo do laboratório)", distanciaM: 640 },
  { tipo: "universidade", categoria: "educacao", nome: "Campus Santa Mônica (exemplo do laboratório)", distanciaM: 1200 },
  { tipo: "escola", categoria: "educacao", nome: "Escola Estadual do Bairro (exemplo do laboratório)", distanciaM: 450 },
  { tipo: "coworking", categoria: "trabalho", nome: "Coworking Centro (exemplo do laboratório)", distanciaM: 900 },
  { tipo: "mercado", categoria: "mercado", nome: "Supermercado do Bairro (exemplo do laboratório)", distanciaM: 350 },
  { tipo: "onibus", categoria: "transporte", nome: "Parada de ônibus", distanciaM: 90 },
];

/**
 * E952: no laboratório, uma lista por CEP — o Jardim Europa (38414-536, o CEP do caso do Daniel) tem lista e ponto
 * próprios, longe do Umuarama; os demais CEPs, a lista de sempre. Só laboratório (INTEGRACOES_SIMULADAS=on).
 */
export const CEP_LAB_JARDIM_EUROPA = "38414536";
export const PROXIMIDADES_LAB_JARDIM_EUROPA: LugarProximo[] = [
  { tipo: "farmacia", categoria: "saude", nome: "Drogaria Jardim Europa (exemplo do laboratório)", distanciaM: 310 },
  { tipo: "escola", categoria: "educacao", nome: "Escola Municipal Jardim Europa (exemplo do laboratório)", distanciaM: 520 },
  { tipo: "mercado", categoria: "mercado", nome: "Mercado Jardim Europa (exemplo do laboratório)", distanciaM: 260 },
  { tipo: "onibus", categoria: "transporte", nome: "Ponto de ônibus Jardim Europa (exemplo do laboratório)", distanciaM: 120 },
];
export function proximidadesDoLab(cep: string | null): { ponto: { lat: number; lng: number }; itens: LugarProximo[] } {
  if ((cep ?? "").replace(/\D/g, "") === CEP_LAB_JARDIM_EUROPA) return { ponto: { lat: -18.9456, lng: -48.3245 }, itens: PROXIMIDADES_LAB_JARDIM_EUROPA };
  return { ponto: { lat: -18.918, lng: -48.258 }, itens: PROXIMIDADES_LAB };
}

/**
 * Servidores Overpass, em ordem: o principal (overpass-api.de) e o espelho público da Kumi Systems
 * (overpass.kumi.systems), cuja política aceita uso público sem chave, com o mesmo cuidado de volume. Só passa ao
 * espelho quando o principal recusa (429/5xx) ou não responde.
 */
export const OVERPASS_SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"] as const;
