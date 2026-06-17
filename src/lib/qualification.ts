/*
  Lógica do Checklist de Qualificação (Fase 4) — o coração do Viva Nomads.

  Camada 1 (ELEGIBILIDADE): bloqueia ou libera a publicação do anúncio.
  Camada 2 (PONTUAÇÃO 0–100): gera o selo dourado "Pronto para Trabalho" (>= 70).

  Mantido como módulo puro para que UI (cliente) e validação (servidor) usem
  exatamente as mesmas regras.
*/

export interface EligibilityState {
  furnished: boolean; // Imóvel mobiliado completo
  accepts30days: boolean; // Aceita período mínimo de 30 dias
  iptuOk: boolean; // IPTU em dia
  habitable: boolean; // Água, luz, gás
  isOwnerOrAgent: boolean; // Proprietário ou procurador legal
  hasDocument: boolean; // Matrícula ou contrato de gestão enviado
  condoAllows: "yes" | "no" | "unknown";
}

export interface QualityState {
  // Bloco A — espaço de trabalho no imóvel (até 50 pts)
  hasHomeOffice: boolean; // 20
  hasDesk: boolean; // 10
  hasChair: boolean; // 8
  internetFiber: boolean; // 12 (com Mbps)
  internetMbps: number;
  // Bloco B — espaços de trabalho próximos (até 30 pts)
  coworking2km: boolean; // 12
  meetingRoom: boolean; // 10
  cafe1km: boolean; // 8
  // Bloco C — conforto para estadia longa (até 20 pts)
  washer: boolean; // 6
  fullKitchen: boolean; // 6
  acBedrooms: boolean; // 4
  petsOk: boolean; // 4
}

export const WORK_READY_THRESHOLD = 70;

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

/** Calcula a elegibilidade final da Camada 1. */
export function isEligible(s: EligibilityState): boolean {
  const allRequired = eligibilityChecks(s).every((c) => c.ok);
  // Se a convenção do condomínio PROÍBE, bloqueia. "Não sei" não bloqueia (orienta verificar).
  return allRequired && s.condoAllows !== "no";
}

/** Itens de pontuação da Camada 2 com seus pesos, agrupados por bloco. */
export function scoreBreakdown(q: QualityState) {
  const blockA = [
    { label: "Cômodo/escritório dedicado (home office)", pts: 20, on: q.hasHomeOffice },
    { label: "Mesa de trabalho adequada", pts: 10, on: q.hasDesk },
    { label: "Cadeira ergonômica ou de trabalho", pts: 8, on: q.hasChair },
    { label: "Internet fibra", pts: 12, on: q.internetFiber },
  ];
  const blockB = [
    { label: "Coworking a menos de 2 km", pts: 12, on: q.coworking2km },
    { label: "Sala de reunião no condomínio ou próxima", pts: 10, on: q.meetingRoom },
    { label: "Café/espaço de trabalho a menos de 1 km", pts: 8, on: q.cafe1km },
  ];
  const blockC = [
    { label: "Máquina de lavar no imóvel", pts: 6, on: q.washer },
    { label: "Cozinha completa equipada", pts: 6, on: q.fullKitchen },
    { label: "Ar-condicionado nos quartos", pts: 4, on: q.acBedrooms },
    { label: "Aceita pets", pts: 4, on: q.petsOk },
  ];
  return { blockA, blockB, blockC };
}

/** Soma a pontuação total (0–100). */
export function computeScore(q: QualityState): number {
  const { blockA, blockB, blockC } = scoreBreakdown(q);
  return [...blockA, ...blockB, ...blockC].reduce((sum, i) => sum + (i.on ? i.pts : 0), 0);
}

export function hasWorkReadyBadge(q: QualityState): boolean {
  return computeScore(q) >= WORK_READY_THRESHOLD;
}
