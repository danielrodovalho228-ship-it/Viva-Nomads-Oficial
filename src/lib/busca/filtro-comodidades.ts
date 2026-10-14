/*
  Filtros de estadia longa da /buscar (ordem 583d2e71) — PURO. Usa as comodidades
  JÁ cadastradas (src/lib/amenities.ts, fonte única). Regra: imóvel sem a
  informação NÃO aparece no filtro; com vários filtros ligados, precisa ter todos.
*/
import { AMENITY_LABEL } from "../amenities.ts";

export type ComodidadeFiltro = "wifi" | "cozinha" | "garagem" | "lavar";

export const COMODIDADES_FILTRO: { chave: ComodidadeFiltro; rotulo: string; dica: string; amenityKey: string }[] = [
  { chave: "wifi", rotulo: "Wi-Fi", dica: "Internet fibra de alta velocidade", amenityKey: "internet_fibra" },
  { chave: "cozinha", rotulo: "Cozinha equipada", dica: "Fogão, geladeira e utensílios", amenityKey: "cozinha_equipada" },
  { chave: "garagem", rotulo: "Garagem", dica: "Vaga de garagem", amenityKey: "vaga_garagem" },
  { chave: "lavar", rotulo: "Máquina de lavar", dica: "Lavar roupa sem sair de casa", amenityKey: "maquina_lavar" },
];

export const ROTULO_COMODIDADE: Record<ComodidadeFiltro, string> = Object.fromEntries(
  COMODIDADES_FILTRO.map((c) => [c.chave, c.rotulo])
) as Record<ComodidadeFiltro, string>;

/** Rótulos gravados em property_amenities que a busca consulta (uma consulta só, sem N+1). */
export const ROTULOS_FILTRAVEIS: string[] = COMODIDADES_FILTRO.map((c) => AMENITY_LABEL[c.amenityKey]);

const CHAVE_POR_ROTULO: Record<string, ComodidadeFiltro> = Object.fromEntries(
  COMODIDADES_FILTRO.map((c) => [AMENITY_LABEL[c.amenityKey], c.chave])
);

/** Converte rótulos cadastrados nas chaves de filtro que eles atendem. */
export function chavesFiltroDe(rotulos: string[]): ComodidadeFiltro[] {
  return [...new Set(rotulos.map((r) => CHAVE_POR_ROTULO[r]).filter(Boolean))];
}

type ImovelComodidades = {
  amenities?: string[];
  comodidadesFiltro?: string[];
  parkingSpots?: number;
};

export function temComodidade(p: ImovelComodidades, chave: ComodidadeFiltro): boolean {
  if (chave === "garagem" && (p.parkingSpots ?? 0) > 0) return true;
  const chaves = p.comodidadesFiltro ?? chavesFiltroDe(p.amenities ?? []);
  return chaves.includes(chave);
}

/** Todas as comodidades pedidas (E). Lista vazia = sem filtro. */
export function passaComodidades(p: ImovelComodidades, pedidas: ComodidadeFiltro[]): boolean {
  return pedidas.every((c) => temComodidade(p, c));
}

/** `?comod=wifi,garagem` → só chaves conhecidas, sem repetição. */
export function comodidadesDaUrl(valor: string | null): ComodidadeFiltro[] {
  if (!valor) return [];
  const validas = new Set<string>(COMODIDADES_FILTRO.map((c) => c.chave));
  return [...new Set(valor.split(",").map((s) => s.trim()))].filter((s): s is ComodidadeFiltro => validas.has(s));
}
