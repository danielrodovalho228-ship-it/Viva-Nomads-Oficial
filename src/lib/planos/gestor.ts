/**
 * Elegibilidade do plano GESTOR (fonte única, pura e client-safe).
 *
 * Gestor é plano de ELEGIBILIDADE, não de prateleira: disponível só para
 *  (a) contas do tipo 'gestor' (administradora — marcada por admin, com
 *      auditoria); ou
 *  (b) proprietários com 20+ imóveis de documentação APROVADA — o mesmo
 *      mínimo do preço do Gestor (GESTOR_PRECO.minimoImoveis, config/planos):
 *      abaixo disso o Profissional sai mais barato e o Gestor só tiraria
 *      comissão de quem tem poucos imóveis de aluguel alto.
 * Sem elegibilidade, o card do Gestor vira META ("valide N imóveis para
 * desbloquear") + venda assistida ("Fale com a gente"), nunca porta muda.
 */
import { GESTOR_PRECO } from "../../config/planos.ts";

export const GESTOR_MIN_IMOVEIS_VALIDADOS: number = GESTOR_PRECO.minimoImoveis;

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

/**
 * E224 — a linha do Plano Gestor na Conta (proprietário). Sem botão de assinar: não há cobrança ligada; quem já está
 * liberado fala com a Viva para ativar.
 */
export function textoElegibilidadeGestor(e: { elegivel: boolean; imoveisValidados: number; faltam: number }): string {
  if (e.elegivel) return "Liberado. Fale com a Viva para ativar.";
  return `Plano Gestor: liberado com ${GESTOR_MIN_IMOVEIS_VALIDADOS} imóveis com documento aprovado. Você tem ${e.imoveisValidados}; faltam ${e.faltam}.`;
}

/** E224 — como o admin vê o tipo da conta (os valores são os que definirAccountType aceita). */
export const ROTULO_TIPO_CONTA: Readonly<Record<AccountType, string>> = { individual: "individual", gestor: "administradora" };

/** Motivo da troca de tipo: obrigatório, com pelo menos 5 caracteres de texto. */
export const MOTIVO_TIPO_MIN = 5;
export function motivoTipoValido(m: string | null | undefined): boolean {
  return (m ?? "").trim().length >= MOTIVO_TIPO_MIN;
}
