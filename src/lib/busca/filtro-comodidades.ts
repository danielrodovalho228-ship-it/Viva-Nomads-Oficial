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

/**
 * FILTROS-2 (decisão do dono, 23/10): o que é item do PADRÃO MÍNIMO de 12 itens é garantia da plataforma, não filtro.
 * Wi-Fi = "Internet informada" e Cozinha equipada = "Cozinha básica" (src/config/conforto-minimo.ts). Saem da folha;
 * o painel mostra a linha de garantia no lugar. Garagem e Máquina de lavar NÃO são do mínimo (o mínimo pede só ACESSO a
 * uma máquina, no imóvel ou no prédio; o chip pede máquina no imóvel) e continuam filtros.
 */
export const COMODIDADE_DO_MINIMO: Partial<Record<ComodidadeFiltro, string>> = { wifi: "internet_informada", cozinha: "cozinha_basica" };
export const ehGarantidaPeloMinimo = (c: ComodidadeFiltro): boolean => c in COMODIDADE_DO_MINIMO;
/** Os chips de comodidade que a folha mostra (os que não são garantia do mínimo). */
export const COMODIDADES_FILTRAVEIS = COMODIDADES_FILTRO.filter((c) => !ehGarantidaPeloMinimo(c.chave));

export const ROTULO_COMODIDADE: Record<ComodidadeFiltro, string> = Object.fromEntries(
  COMODIDADES_FILTRO.map((c) => [c.chave, c.rotulo])
) as Record<ComodidadeFiltro, string>;

/**
 * FILTROS-1 (E39): outros rótulos que o anúncio usa para a MESMA comodidade. O chip "Wi-Fi" lia só "Internet fibra de
 * alta velocidade", e os anúncios declaram "Wi-Fi" — o chip zerava a busca (0 de 15).
 */
export const SINONIMOS_COMODIDADE: Record<string, ComodidadeFiltro> = {
  "Wi-Fi": "wifi",
  WiFi: "wifi",
  Wifi: "wifi",
  Internet: "wifi",
  "Internet fibra": "wifi",
};

const CHAVE_POR_ROTULO: Record<string, ComodidadeFiltro> = {
  ...Object.fromEntries(COMODIDADES_FILTRO.map((c) => [AMENITY_LABEL[c.amenityKey], c.chave])),
  ...SINONIMOS_COMODIDADE,
};

/** Rótulos gravados em property_amenities que a busca consulta (uma consulta só, sem N+1). */
export const ROTULOS_FILTRAVEIS: string[] = Object.keys(CHAVE_POR_ROTULO);

/** Converte rótulos cadastrados nas chaves de filtro que eles atendem. */
export function chavesFiltroDe(rotulos: string[]): ComodidadeFiltro[] {
  return [...new Set(rotulos.map((r) => CHAVE_POR_ROTULO[r]).filter(Boolean))];
}

type ImovelComodidades = {
  amenities?: string[];
  comodidadesFiltro?: string[];
  parkingSpots?: number;
  /** Velocidade informada pelo dono (campo estruturado do anúncio). */
  internetMbps?: number;
  internetMedida?: { downloadMbps: number } | null;
};

export function temComodidade(p: ImovelComodidades, chave: ComodidadeFiltro): boolean {
  if (chave === "garagem" && (p.parkingSpots ?? 0) > 0) return true;
  // E39: internet informada (Mbps) ou medida também é "Wi-Fi" — o mesmo dado estruturado que o cadastro coleta.
  if (chave === "wifi" && ((p.internetMbps ?? 0) > 0 || (p.internetMedida?.downloadMbps ?? 0) > 0)) return true;
  const chaves = p.comodidadesFiltro ?? chavesFiltroDe(p.amenities ?? []);
  return chaves.includes(chave);
}

/**
 * Todas as comodidades pedidas (E). Lista vazia = sem filtro. As garantidas pelo mínimo não filtram (todo anúncio na
 * busca tem o mínimo; quem não tem está em adequação e fora dos resultados — ver cumpreGarantiaMinima).
 */
export function passaComodidades(p: ImovelComodidades, pedidas: ComodidadeFiltro[]): boolean {
  return pedidas.every((c) => ehGarantidaPeloMinimo(c) || temComodidade(p, c));
}

/** `?comod=garagem,lavar` → só chaves que ainda são filtro, sem repetição (links antigos com wifi/cozinha: ignoradas). */
export function comodidadesDaUrl(valor: string | null): ComodidadeFiltro[] {
  if (!valor) return [];
  const validas = new Set<string>(COMODIDADES_FILTRAVEIS.map((c) => c.chave));
  return [...new Set(valor.split(",").map((s) => s.trim()))].filter((s): s is ComodidadeFiltro => validas.has(s));
}
