/*
  E259 item 7 — "O que tem por perto" com FONTE ÚNICA. Na prova de publicação (Av. João Naves de Ávila, 2121, Saraiva,
  Uberlândia) o assistente disse "Não achamos lugares por perto, num raio de 2 km" — o Overpass estourou o tempo nos
  dois servidores e a falha virou "nada por perto" — enquanto a página pública do mesmo anúncio mostrava "≈ 600 m em
  linha reta até a UFU — Campus Santa Mônica" pelo "Tempo até", que lê as âncoras oficiais (tabela destinos).
  Agora as âncoras oficiais da cidade entram na lista do assistente, medidas do MESMO ponto que a página usa, e se juntam
  ao OSM: sem rede, elas continuam lá. PURO (sem "@/…").
  Roda: node --test src/lib/proximidades/ancoras.test.ts
*/
import { distanciaMetros, MAX_POR_CATEGORIA, ORDEM_CATEGORIAS, RAIO_METROS, type LugarProximo, type TipoLugar } from "./osm.ts";
import type { ProximityCategory } from "../types.ts";

export interface DestinoAncora {
  nome: string;
  tipo: "hospital" | "universidade" | "empresa" | "outro";
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
}

const CATEGORIA: Record<Exclude<DestinoAncora["tipo"], "outro">, { tipo: TipoLugar; categoria: ProximityCategory }> = {
  hospital: { tipo: "hospital", categoria: "saude" },
  universidade: { tipo: "universidade", categoria: "educacao" },
  empresa: { tipo: "empresa", categoria: "trabalho" },
};

const semAcento = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** As âncoras oficiais da MESMA cidade (e UF, quando as duas têm) num raio de 2 km do ponto, como lugares por perto. */
export function ancorasPerto(ponto: { lat: number; lng: number }, destinos: readonly DestinoAncora[], local: { cidade: string | null; uf: string | null }): LugarProximo[] {
  const cidade = semAcento(local.cidade);
  if (!cidade) return [];
  const uf = semAcento(local.uf);
  const out: LugarProximo[] = [];
  for (const d of destinos) {
    if (d.tipo === "outro" || d.lat == null || d.lng == null || !d.nome?.trim()) continue;
    if (semAcento(d.cidade) !== cidade || (uf && d.uf && semAcento(d.uf) !== uf)) continue;
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distanciaM = distanciaMetros(ponto, { lat, lng });
    if (distanciaM > RAIO_METROS) continue;
    out.push({ ...CATEGORIA[d.tipo], nome: d.nome.trim(), distanciaM, lat, lng });
  }
  return out;
}

/** Mesmo lugar no OSM e na âncora: mesmo tipo a até 400 m um do outro (o OSM costuma ter o nome longo do campus). */
const RAIO_MESMO_LUGAR = 400;

/**
 * Junta âncoras e OSM: a âncora vence o lugar do OSM que é o mesmo; depois, até 3 por categoria, os mais próximos
 * primeiro, na ordem fixa (Saúde, Educação, Trabalho, Mercado, Transporte).
 */
export function juntarComAncoras(osm: readonly LugarProximo[], ancoras: readonly LugarProximo[]): LugarProximo[] {
  const repetido = (l: LugarProximo) =>
    ancoras.some(
      (a) =>
        a.tipo === l.tipo &&
        (a.nome.toLowerCase() === l.nome.toLowerCase() ||
          (a.lat != null && a.lng != null && l.lat != null && l.lng != null && distanciaMetros(a as { lat: number; lng: number }, l as { lat: number; lng: number }) <= RAIO_MESMO_LUGAR)),
    );
  const todos = [...ancoras, ...osm.filter((l) => !repetido(l))];
  return ORDEM_CATEGORIAS.flatMap((c) =>
    todos
      .filter((l) => l.categoria === c)
      .sort((a, b) => a.distanciaM - b.distanciaM)
      .slice(0, MAX_POR_CATEGORIA),
  );
}

/**
 * A resposta da busca do assistente, com UM ponto de referência para tudo: o ponto público do anúncio já salvo (o mesmo
 * do "Tempo até" da página) ou, num anúncio novo, o ponto do endereço. Os lugares do OSM são medidos de novo a partir
 * dele, e as âncoras oficiais entram sempre que o ponto existe.
 * • OSM que não respondeu (`osm` null) não vira "nada por perto": com âncoras, mostra as âncoras; sem nada, a fonte
 *   fica a da falha ("erro", "limite", "sem_ponto"), que a tela diz como "a busca não respondeu".
 * • "sem_lugares" só quando o OSM respondeu E não há âncora no raio.
 */
export function respostaPerto(e: {
  osm: readonly LugarProximo[] | null;
  /** De onde veio o OSM ("osm", "mapbox", "cache", "lab") ou a falha ("erro", "limite", "sem_ponto"). */
  fonteOsm: string;
  referencia: { lat: number; lng: number } | null;
  ancoras: readonly LugarProximo[];
}): { itens: LugarProximo[]; fonte: string } {
  const ref = e.referencia;
  const osm = (e.osm ?? [])
    .map((l) => (ref && l.lat != null && l.lng != null ? { ...l, distanciaM: distanciaMetros(ref, { lat: l.lat, lng: l.lng }) } : l))
    .filter((l) => l.distanciaM <= RAIO_METROS);
  const itens = juntarComAncoras(osm, e.ancoras);
  if (e.osm === null) return { itens, fonte: itens.length ? "ancoras" : e.fonteOsm };
  return { itens, fonte: itens.length ? e.fonteOsm : "sem_lugares" };
}
