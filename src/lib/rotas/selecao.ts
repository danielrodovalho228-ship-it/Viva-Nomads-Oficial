/*
  Escolha do que vai para o provedor de rotas (Prompt 37) — PURO.
   • endereço digitado: a linha reta escolhe os 40 imóveis mais próximos; só eles vão para a Matrix;
   • lotes: a Matrix aceita até 25 coordenadas por chamada → 1 destino + 24 imóveis por lote.
*/

export interface Ponto {
  lat: number;
  lng: number;
}

/** Máximo de imóveis calculados sob demanda por busca. */
export const MAIS_PROXIMOS = 40;
/** Coordenadas por chamada da Matrix (1 destino + 24 imóveis). */
export const COORDENADAS_POR_CHAMADA = 25;
/** Cálculos novos por hora por IP. */
export const CALCULOS_POR_HORA = 300;

export function distanciaKm(a: Ponto, b: Ponto): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Imóvel tem coordenada utilizável? (null/0,0 = sem ponto: fica de fora do cálculo, nunca vira "perto"). */
export function temCoordenada(p: { lat?: number | null; lng?: number | null }): p is Ponto {
  return typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0);
}

/** Os `n` mais próximos do ponto em linha reta (desempate pelo id, para ser estável). */
export function maisProximos<T extends { id: string; lat?: number | null; lng?: number | null }>(lista: T[], ponto: Ponto, n = MAIS_PROXIMOS): T[] {
  return lista
    .filter(temCoordenada)
    .map((p) => ({ p, d: distanciaKm(ponto, p as Ponto) }))
    .sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0))
    .slice(0, Math.max(0, n))
    .map((x) => x.p);
}

/** Divide em lotes de até `tamanho`. */
export function emLotes<T>(lista: T[], tamanho: number): T[][] {
  if (tamanho < 1) throw new Error("tamanho do lote inválido");
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

/**
 * Lotes da Matrix: cada chamada leva o destino + até 24 imóveis (25 coordenadas no total).
 * Devolve, para cada lote, as coordenadas na ordem da chamada ([destino, ...imóveis]).
 */
export function lotesMatrix<T extends Ponto>(destino: Ponto, imoveis: T[]): { coordenadas: Ponto[]; imoveis: T[] }[] {
  return emLotes(imoveis, COORDENADAS_POR_CHAMADA - 1).map((l) => ({ coordenadas: [destino, ...l.map((p) => ({ lat: p.lat, lng: p.lng }))], imoveis: l }));
}

/**
 * O limite por IP (limites_uso, 1 linha por consumo) conta LOTES: cada lote leva até 24 cálculos novos, então
 * 300 cálculos/hora = 12 lotes/hora (288 cálculos). Uma linha por lote em vez de uma por cálculo.
 */
export const LOTES_POR_HORA = Math.floor(CALCULOS_POR_HORA / (COORDENADAS_POR_CHAMADA - 1));
