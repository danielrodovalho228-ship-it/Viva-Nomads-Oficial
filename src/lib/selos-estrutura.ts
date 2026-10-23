import { SELOS } from "../config/selos.ts";

/**
 * SELOS DE ESTRUTURA (ordem 512f3ed0, parte 1: regras puras). Cada selo só aparece quando TODOS os itens do
 * checklist estão marcados; "Perto de hospital/universidade" é CALCULADO pela localização, nunca autodeclarado.
 * Nenhum selo existente muda (decisão dd52256e). A tela de cadastro e os filtros entram nas próximas partes.
 */
export const CHECKLIST_ACESSIVEL = [
  "entradaSemDegrauOuRampa",
  "elevadorOuTerreo",
  "portas80cm",
  "banheiroAdaptado",
] as const;

export const CHECKLIST_MOBILIDADE_REDUZIDA = [
  "barrasApoioBanheiro",
  "pisoAntiderrapante",
  "boxSemDegrau",
  "camaAlturaConfortavel",
] as const;

export type ItemChecklist = (typeof CHECKLIST_ACESSIVEL)[number] | (typeof CHECKLIST_MOBILIDADE_REDUZIDA)[number];
export type ChecklistEstrutura = Partial<Record<ItemChecklist, boolean>>;

/** Distância máxima (km) até hospital ou universidade da lista da cidade. */
export const RAIO_PERTO_KM = 2;

const tudoMarcado = (c: ChecklistEstrutura | null | undefined, itens: readonly ItemChecklist[]) =>
  !!c && itens.every((i) => c[i] === true);

export const seloAcessivel = (c: ChecklistEstrutura | null | undefined) => tudoMarcado(c, CHECKLIST_ACESSIVEL);
export const seloMobilidadeReduzida = (c: ChecklistEstrutura | null | undefined) =>
  tudoMarcado(c, CHECKLIST_MOBILIDADE_REDUZIDA);

export interface Ponto {
  lat: number;
  lng: number;
}

/** Distância em km entre dois pontos (haversine). */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Verdadeiro se o imóvel está a no máximo RAIO_PERTO_KM de algum ponto da lista. Sem localização válida, falso. */
export function pertoDeAlgum(imovel: Ponto | null | undefined, lugares: readonly Ponto[]): boolean {
  if (!imovel || !Number.isFinite(imovel.lat) || !Number.isFinite(imovel.lng)) return false;
  return lugares.some((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng) && distanciaKm(imovel, l) <= RAIO_PERTO_KM);
}

export type SeloEstruturaId = "acessivel" | "mobilidadeReduzida" | "pertoHospital" | "pertoUniversidade";

export function selosEstrutura(d: {
  checklist?: ChecklistEstrutura | null;
  local?: Ponto | null;
  hospitais?: readonly Ponto[];
  universidades?: readonly Ponto[];
}): SeloEstruturaId[] {
  const ids: SeloEstruturaId[] = [];
  if (seloAcessivel(d.checklist)) ids.push("acessivel");
  if (seloMobilidadeReduzida(d.checklist)) ids.push("mobilidadeReduzida");
  if (pertoDeAlgum(d.local, d.hospitais ?? [])) ids.push("pertoHospital");
  if (pertoDeAlgum(d.local, d.universidades ?? [])) ids.push("pertoUniversidade");
  return ids;
}

export const rotuloSeloEstrutura = (id: SeloEstruturaId) => SELOS[id].nome;
