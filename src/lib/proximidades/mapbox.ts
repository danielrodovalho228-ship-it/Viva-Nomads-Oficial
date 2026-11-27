/*
  E978 opção (i) (coordenador, DUET-1540) — a busca AO VIVO do editor no Mapbox (Search Box, busca por categoria). PURO.
  • O que o editor mostra vem daqui; a lista GUARDADA para a página pública continua só do OSM (ponto do Nominatim +
    lista do Overpass, src/lib/proximidades/osm.ts). O resultado do Mapbox NUNCA é gravado nem vai para cache
    (termos do nível gratuito): ninguém aqui escreve em banco.
  • O token é só do servidor (MAPBOX_SERVER_TOKEN). O token público dos mapas (CARTO/Mapbox GL) não é usado aqui.
  • A escolha dos lugares é a MESMA do OSM (escolherLugares): até 3 por categoria, no raio, parada até 600 m.
*/
import { RAIO_METROS, RAIO_ONIBUS_METROS, escolherLugares, type CandidatoLugar, type LugarProximo, type TipoLugar } from "./osm.ts";

/**
 * As categorias do Mapbox para cada tipo da tela ("empresa" vem só das âncoras oficiais). Mais de uma categoria por tipo
 * quando o Mapbox separa o que a tela junta (universidade + faculdade). Uma categoria que o Mapbox não conheça devolve
 * erro e só ela fica de fora (a etapa registra "mapbox:<categoria>:<status>").
 */
export const CATEGORIAS_MAPBOX: Record<Exclude<TipoLugar, "empresa">, readonly string[]> = {
  hospital: ["hospital"],
  universidade: ["university", "college"],
  escola: ["school"],
  mercado: ["supermarket"],
  farmacia: ["pharmacy"],
  academia: ["fitness_center", "gym"],
  onibus: ["bus_stop"],
  coworking: ["coworking_space"],
};

/** O token do Mapbox para a busca do servidor: SÓ a variável de servidor (nunca a NEXT_PUBLIC dos mapas). */
export function tokenMapboxServidor(env: Record<string, string | undefined> = process.env): string | null {
  const t = (env.MAPBOX_SERVER_TOKEN ?? "").trim();
  return t ? t : null;
}

/** Caixa (lng/lat) em volta do ponto, com o raio em metros — a busca não traz lugar de fora dele. */
export function caixaDoRaio(p: { lat: number; lng: number }, raioM: number): [number, number, number, number] {
  const dLat = raioM / 111_320;
  const dLng = raioM / (111_320 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180)));
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return [r(p.lng - dLng), r(p.lat - dLat), r(p.lng + dLng), r(p.lat + dLat)];
}

/** URL da busca por categoria: perto do ponto, dentro do raio, em português, no Brasil. */
export function urlCategoriaMapbox(categoria: string, ponto: { lat: number; lng: number }, token: string, raioM = RAIO_METROS): string {
  const q = new URLSearchParams({
    access_token: token,
    proximity: `${ponto.lng},${ponto.lat}`,
    bbox: caixaDoRaio(ponto, raioM).join(","),
    language: "pt",
    country: "BR",
    limit: "10",
  });
  return `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(categoria)}?${q.toString()}`;
}

/** O raio da busca de cada tipo (parada de ônibus só até 600 m, como no OSM). */
export const raioDoTipo = (tipo: TipoLugar): number => (tipo === "onibus" ? RAIO_ONIBUS_METROS : RAIO_METROS);

interface FeatureMapbox {
  geometry?: { coordinates?: unknown };
  properties?: { name?: unknown; coordinates?: { latitude?: unknown; longitude?: unknown } };
}

/** Os lugares de UMA resposta (GeoJSON FeatureCollection) como candidatos; resposta fora do formato: nenhum. */
function candidatosDaResposta(tipo: TipoLugar, json: unknown): CandidatoLugar[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  return (features as FeatureMapbox[]).flatMap((f) => {
    const c = Array.isArray(f.geometry?.coordinates) ? (f.geometry!.coordinates as unknown[]) : null;
    const lng = Number(c ? c[0] : f.properties?.coordinates?.longitude);
    const lat = Number(c ? c[1] : f.properties?.coordinates?.latitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ tipo, nome: typeof f.properties?.name === "string" ? f.properties.name : "", lat, lng }];
  });
}

/** As respostas do Mapbox (uma por categoria) viram a lista da tela, com a MESMA escolha do OSM. */
export function lugaresDoMapbox(respostas: readonly { tipo: TipoLugar; json: unknown }[], origem: { lat: number; lng: number }): LugarProximo[] {
  return escolherLugares(
    respostas.flatMap((r) => candidatosDaResposta(r.tipo, r.json)),
    origem,
  );
}
