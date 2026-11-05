/**
 * Elegibilidade do plano GESTOR (fonte única, pura e client-safe).
 *
 * Gestor é plano de ELEGIBILIDADE, não de prateleira: disponível só para
 *  (a) contas do tipo 'gestor' (administradora — marcada por admin, com
 *      auditoria); ou
 *  (b) proprietários com 20+ imóveis ATIVOS DE VERDADE (E565: publicados, com
 *      documento aprovado e calendário em dia) — GESTOR_PRECO.minimoImoveis.
 * E564: o Gestor é a taxa de 4% por contrato, sem assinatura; vale sozinho nos
 * próximos contratos (a mesma faixa de lib/cobranca/regra.ts).
 * Sem elegibilidade, o card do Gestor vira META ("valide N imóveis para
 * desbloquear") + venda assistida ("Fale com a gente"), nunca porta muda.
 */
import { GESTOR_PRECO } from "../../config/planos.ts";

export const GESTOR_MIN_IMOVEIS_VALIDADOS: number = GESTOR_PRECO.minimoImoveis;

export type AccountType = "individual" | "gestor";

export interface GestorSinais {
  /** Tipo da conta (profiles.account_type). */
  accountType: AccountType | string | null | undefined;
  /** Nº de imóveis do dono que contam para a faixa (E565: ativos de verdade). */
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
  if (s.accountType === "gestor") return "Conta de administradora: Plano Gestor, taxa de 4%.";
  const faltam = faltamParaGestor(s.imoveisValidados);
  if (faltam === 0) return `Você tem ${GESTOR_MIN_IMOVEIS_VALIDADOS}+ imóveis ativos: Plano Gestor, taxa de 4%.`;
  return `Ative ${faltam} imóvel(is) para chegar ao Plano Gestor (${s.imoveisValidados ?? 0}/${GESTOR_MIN_IMOVEIS_VALIDADOS}).`;
}

/**
 * E224/E564 — a linha do Plano Gestor na Conta (proprietário). Sem assinatura: a taxa de 4% vale sozinha nos próximos
 * contratos de quem chega lá.
 */
export function textoElegibilidadeGestor(e: { elegivel: boolean; imoveisValidados: number; faltam: number }): string {
  if (e.elegivel) return "Plano Gestor: taxa de 4% nos próximos contratos, sem assinatura.";
  return `Plano Gestor: taxa de 4% com ${GESTOR_MIN_IMOVEIS_VALIDADOS} imóveis ativos (publicados, com documento aprovado e calendário em dia). Você tem ${e.imoveisValidados}; faltam ${e.faltam}.`;
}

/** E224 — como o admin vê o tipo da conta (os valores são os que definirAccountType aceita). */
export const ROTULO_TIPO_CONTA: Readonly<Record<AccountType, string>> = { individual: "individual", gestor: "administradora" };

/** Motivo da troca de tipo: obrigatório, com pelo menos 5 caracteres de texto. */
export const MOTIVO_TIPO_MIN = 5;
export function motivoTipoValido(m: string | null | undefined): boolean {
  return (m ?? "").trim().length >= MOTIVO_TIPO_MIN;
}
