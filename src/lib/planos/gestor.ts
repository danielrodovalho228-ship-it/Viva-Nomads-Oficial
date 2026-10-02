/**
 * Elegibilidade do plano GESTOR (fonte única, pura e client-safe).
 *
 * Gestor é plano de ELEGIBILIDADE, não de prateleira: disponível só para
 *  (a) contas do tipo 'gestor' (administradora — marcada por admin, com
 *      auditoria); ou
 *  (b) proprietários com 5+ imóveis de documentação APROVADA.
 * Sem elegibilidade, o card do Gestor vira META ("valide 5 imóveis para
 * desbloquear") + venda assistida ("Fale com a gente"), nunca porta muda.
 */

export const GESTOR_MIN_IMOVEIS_VALIDADOS = 5;

export type AccountType = "individual" | "gestor";

export interface GestorSinais {
  /** Tipo da conta (profiles.account_type). */
  accountType: AccountType | string | null | undefined;
  /** Nº de imóveis do dono com documentação aprovada (moderação). */
  imoveisValidados: number;
}

/** A conta pode ativar o Gestor? */
export function gestorElegivel(s: GestorSinais): boolean {
  if (s.accountType === "gestor") return true;
  return (s.imoveisValidados ?? 0) >= GESTOR_MIN_IMOVEIS_VALIDADOS;
}

/** Quantos imóveis validados ainda faltam para desbloquear (0 se já elegível). */
export function faltamParaGestor(imoveisValidados: number): number {
  return Math.max(0, GESTOR_MIN_IMOVEIS_VALIDADOS - (imoveisValidados ?? 0));
}

/** Motivo da elegibilidade (para a UI explicar o caminho). */
export function motivoGestor(s: GestorSinais): string {
  if (s.accountType === "gestor") return "Conta de administradora (Gestor liberado).";
  const faltam = faltamParaGestor(s.imoveisValidados);
  if (faltam === 0) return `Você tem ${GESTOR_MIN_IMOVEIS_VALIDADOS}+ imóveis validados — Gestor liberado.`;
  return `Valide ${faltam} imóvel(is) para desbloquear o Gestor (${s.imoveisValidados ?? 0}/${GESTOR_MIN_IMOVEIS_VALIDADOS}).`;
}
