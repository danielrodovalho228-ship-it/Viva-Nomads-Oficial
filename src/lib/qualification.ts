/*
  Checklist de Qualificação (Fase 4 + Atualização 11 — selos em camadas).

  Camada 1 (ELEGIBILIDADE): bloqueia/libera a publicação.
  Camada 2: calcula o selo BASE "Pronto para Morar" (0–100) + 3 ETIQUETAS de
  especialização (trabalhar de casa, bem localizado p/ trabalho, aceito em condomínio).
*/

import { type InternetTier, internetWorksForRemote } from "./internet";

export interface EligibilityState {
  furnished: boolean;
  accepts30days: boolean;
  iptuOk: boolean;
  habitable: boolean;
  isOwnerOrAgent: boolean;
  hasDocument: boolean;
  condoAllows: "" | "yes" | "no" | "unknown"; // "" = ainda não respondido (neutro)
}

export interface QualityState {
  // ── Base "Pronto para Morar" (até 100) ──
  furnishedFull: boolean; // 20 mobília completa
  kitchenEquipped: boolean; // 15 cozinha equipada
  beddingTowels: boolean; // 10 roupa de cama e banho
  appliancesOk: boolean; // 20 eletrodomésticos funcionando
  internetTier: InternetTier; // 15 internet (>= trabalho_remoto pontua)
  climateControl: boolean; // 10 ar-condicionado/aquecimento
  cleanConserved: boolean; // 10 limpeza e conservação
  // ── Etiqueta "Para trabalhar de casa" (home office no imóvel) ──
  hasHomeOffice: boolean;
  hasDesk: boolean;
  hasChair: boolean;
  // ── Etiqueta "Bem localizado para trabalho" (externos) ──
  coworking2km: boolean;
  meetingRoom: boolean;
  cafe1km: boolean;
}

export const READY_TO_LIVE_THRESHOLD = 70;

/** Itens obrigatórios da Camada 1 (exceto o radio do condomínio). */
export function eligibilityChecks(s: EligibilityState) {
  return [
    { key: "furnished", label: "Imóvel mobiliado completo", ok: s.furnished },
    { key: "accepts30days", label: "Aceita período mínimo de 30 dias", ok: s.accepts30days },
    { key: "iptuOk", label: "IPTU em dia", ok: s.iptuOk },
    { key: "habitable", label: "Condições de habitabilidade (água, luz, gás)", ok: s.habitable },
    { key: "isOwnerOrAgent", label: "Proprietário ou procurador legal", ok: s.isOwnerOrAgent },
    { key: "hasDocument", label: "Documentação do imóvel enviada (matrícula ou contrato de gestão)", ok: s.hasDocument },
  ];
}

export function isEligible(s: EligibilityState): boolean {
  const allRequired = eligibilityChecks(s).every((c) => c.ok);
  return allRequired && s.condoAllows !== "no";
}

/** Itens do selo BASE "Pronto para Morar" com pesos. */
export function readyToLiveItems(q: QualityState) {
  return [
    { key: "furnishedFull", label: "Mobília completa", pts: 20, on: q.furnishedFull },
    { key: "kitchenEquipped", label: "Cozinha equipada", pts: 15, on: q.kitchenEquipped },
    { key: "beddingTowels", label: "Roupa de cama e banho inclusas", pts: 10, on: q.beddingTowels },
    { key: "appliancesOk", label: "Eletrodomésticos funcionando (geladeira, fogão, micro-ondas, lavar)", pts: 20, on: q.appliancesOk },
    { key: "internet", label: "Internet que aguenta trabalho", pts: 15, on: internetWorksForRemote(q.internetTier) },
    { key: "climateControl", label: "Ar-condicionado / aquecimento", pts: 10, on: q.climateControl },
    { key: "cleanConserved", label: "Limpeza e conservação", pts: 10, on: q.cleanConserved },
  ] as const;
}

export function readyToLiveScore(q: QualityState): number {
  return readyToLiveItems(q).reduce((sum, i) => sum + (i.on ? i.pts : 0), 0);
}

export function hasReadyToLiveBadge(q: QualityState): boolean {
  return readyToLiveScore(q) >= READY_TO_LIVE_THRESHOLD;
}

/** Etiqueta "Para trabalhar de casa": home office completo no imóvel. */
export function tagHomeOffice(q: QualityState): boolean {
  return q.hasHomeOffice && q.hasDesk && q.hasChair && internetWorksForRemote(q.internetTier);
}

/** Etiqueta "Bem localizado para trabalho": espaços externos próximos. */
export function tagWorkLocated(q: QualityState): boolean {
  return q.coworking2km || q.meetingRoom || q.cafe1km;
}

/** Etiqueta "Aceito em condomínio": convenção permite temporada. */
export function tagCondoApproved(elig: EligibilityState): boolean {
  return elig.condoAllows === "yes";
}

/** Itens das etiquetas (para exibir o que falta). */
export function homeOfficeItems(q: QualityState) {
  return [
    { label: "Cômodo/escritório dedicado", on: q.hasHomeOffice },
    { label: "Mesa de trabalho adequada", on: q.hasDesk },
    { label: "Cadeira de trabalho", on: q.hasChair },
    // Internet vem da categoria escolhida no selo base (não é um toggle aqui).
    { label: "Internet que aguenta trabalho", on: internetWorksForRemote(q.internetTier), readonly: true },
  ];
}

export function workLocatedItems(q: QualityState) {
  return [
    { label: "Coworking na região", on: q.coworking2km },
    { label: "Sala de reunião por perto", on: q.meetingRoom },
    { label: "Café de trabalho na região", on: q.cafe1km },
  ];
}
