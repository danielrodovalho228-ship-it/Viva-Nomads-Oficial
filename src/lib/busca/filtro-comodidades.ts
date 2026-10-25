/*
  Filtros de estadia longa da /buscar (ordem 583d2e71) — PURO. Usa as comodidades
  JÁ cadastradas (src/lib/amenities.ts, fonte única). Regra: imóvel sem a
  informação NÃO aparece no filtro; com vários filtros ligados, precisa ter todos.
*/
import { AMENITY_LABEL } from "../amenities.ts";

export type ComodidadeFiltro = "cozinha" | "garagem" | "lavar";
/**
 * Adendo 3 (E39): chave que saiu. Só existe no TIPO para filtros antigos (links, buscas salvas e o teste de estilo da
 * Pista A) continuarem compilando — nunca filtra, nunca conta e nunca aparece (comodidadesValidas a tira).
 */
export type ComodidadeAntiga = "wifi";

export const COMODIDADES_FILTRO: { chave: ComodidadeFiltro; rotulo: string; dica: string; amenityKey: string }[] = [
  { chave: "cozinha", rotulo: "Cozinha equipada", dica: "Fogão, geladeira e utensílios", amenityKey: "cozinha_equipada" },
  { chave: "garagem", rotulo: "Garagem", dica: "Vaga de garagem", amenityKey: "vaga_garagem" },
  { chave: "lavar", rotulo: "Máquina de lavar", dica: "Lavar roupa sem sair de casa", amenityKey: "maquina_lavar" },
];

/**
 * FILTROS-2 (decisão do dono, 23/10): o que é item do PADRÃO MÍNIMO de 12 itens é garantia da plataforma, não filtro.
 * Cozinha equipada = "Cozinha básica" (src/config/conforto-minimo.ts): sai da folha; o painel mostra a linha de garantia
 * no lugar. Garagem e Máquina de lavar NÃO são do mínimo (o mínimo pede só ACESSO a uma máquina, no imóvel ou no prédio;
 * o chip pede máquina no imóvel) e continuam filtros.
 * Adendo 3 (E39): "Wi-Fi" deixou de existir como comodidade — prometia velocidade sem medição. "Internet informada" é
 * item obrigatório do Essencial; a internet só se filtra pela seção de velocidade MEDIDA (filtro-internet.ts).
 */
export const COMODIDADE_DO_MINIMO: Partial<Record<ComodidadeFiltro, string>> = { cozinha: "cozinha_basica" };
export const ehGarantidaPeloMinimo = (c: ComodidadeFiltro): boolean => c in COMODIDADE_DO_MINIMO;
/** Os chips de comodidade que a folha mostra (os que não são garantia do mínimo). */
export const COMODIDADES_FILTRAVEIS = COMODIDADES_FILTRO.filter((c) => !ehGarantidaPeloMinimo(c.chave));

export const ROTULO_COMODIDADE: Record<ComodidadeFiltro, string> = Object.fromEntries(
  COMODIDADES_FILTRO.map((c) => [c.chave, c.rotulo])
) as Record<ComodidadeFiltro, string>;

const CHAVE_POR_ROTULO: Record<string, ComodidadeFiltro> = {
  ...Object.fromEntries(COMODIDADES_FILTRO.map((c) => [AMENITY_LABEL[c.amenityKey], c.chave])),
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
};

export function temComodidade(p: ImovelComodidades, chave: ComodidadeFiltro): boolean {
  if (chave === "garagem" && (p.parkingSpots ?? 0) > 0) return true;
  const chaves = p.comodidadesFiltro ?? chavesFiltroDe(p.amenities ?? []);
  return chaves.includes(chave);
}

/**
 * Todas as comodidades pedidas (E). Lista vazia = sem filtro. As garantidas pelo mínimo não filtram (todo anúncio na
 * busca tem o mínimo; quem não tem está em adequação e fora dos resultados — ver cumpreGarantiaMinima).
 */
export function passaComodidades(p: ImovelComodidades, pedidas: readonly (ComodidadeFiltro | ComodidadeAntiga)[]): boolean {
  return comodidadesValidas(pedidas).every((c) => ehGarantidaPeloMinimo(c) || temComodidade(p, c));
}

/** Só as chaves que ainda existem (a antiga "wifi" sai sem erro). */
export function comodidadesValidas(lista: readonly string[]): ComodidadeFiltro[] {
  const existe = new Set<string>(COMODIDADES_FILTRO.map((c) => c.chave));
  return [...new Set(lista)].filter((c): c is ComodidadeFiltro => existe.has(c));
}

/** `?comod=garagem,lavar` → só chaves que ainda são filtro, sem repetição (links antigos com wifi/cozinha: ignorados, sem erro). */
export function comodidadesDaUrl(valor: string | null): ComodidadeFiltro[] {
  if (!valor) return [];
  const validas = new Set<string>(COMODIDADES_FILTRAVEIS.map((c) => c.chave));
  return [...new Set(valor.split(",").map((s) => s.trim()))].filter((s): s is ComodidadeFiltro => validas.has(s));
}
