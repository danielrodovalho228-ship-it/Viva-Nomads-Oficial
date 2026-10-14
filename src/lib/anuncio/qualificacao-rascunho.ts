import { isEligible, type EligibilityState } from "../qualification.ts";

/**
 * F8 (ordem 1cfccb8f): a qualificação "Antes de anunciar" é POR IMÓVEL. Ao
 * retomar um rascunho, o assistente só considera o imóvel qualificado se o
 * servidor tem uma qualificação ELEGÍVEL para ele — sem registro, não está.
 */
export function qualificadoDoServidor(q: { elig: EligibilityState } | null): boolean {
  return !!q && isEligible(q.elig);
}
