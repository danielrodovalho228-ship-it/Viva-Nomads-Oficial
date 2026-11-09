/*
  Caução flexível + política de reembolso — regras PURAS (sem efeito colateral).

  Princípio inegociável (regra de ouro): a plataforma conecta, verifica,
  documenta e registra — NUNCA recebe, retém nem transfere o valor. Por isso
  aqui só há CÁLCULO e REGISTRO. O dinheiro vai para a poupança da caução (em nome
  do locador) ou para a instituição emissora (no parcelado) — nunca para a
  plataforma. O reembolso é PAGO pelo locador; a plataforma só documenta.
*/
import { REGRAS_CONTRATO } from "../config/planos.ts";

export type FormaPagamentoCaucao = "avista" | "parcelado";
export type DestinoValor = "conta_vinculada" | "emissor";
export type StatusReembolso = "pendente" | "registrado";

/** Desconto comprovado no reembolso (dano/pendência), com evidência. */
export interface DescontoReembolso {
  motivo: string;
  valor: number;
  evidencia: string | null;
}

/** Registro de reembolso — documental. Nenhum campo movimenta dinheiro. */
export interface Reembolso {
  vistoriaSaidaId: string | null;
  caucao: number;
  descontos: DescontoReembolso[];
  valorDevolver: number;
  status: StatusReembolso;
  comprovanteUrl: string | null;
  prazoLimite: string | null; // ISO — 30 dias após a entrega das chaves
}

export const MAX_PARCELAS = 12;
/** Caução para mobiliado: ~10% do valor dos móveis… */
export const PERC_MOVEIS = 0.1;
/** …sem ultrapassar 30% do total da estadia. */
export const TETO_ESTADIA = 0.3;
/** Prazo legal de devolução após a entrega das chaves. E707: é só o TETO EXTERNO; a devolução é devida de imediato quando há liberação integral. */
export const PRAZO_REEMBOLSO_DIAS = 30;

/** Soma `n` dias corridos a uma data AAAA-MM-DD (calendário, sem fuso). */
export function addDiasCorridos(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** E707 — teto externo da devolução: 30 dias corridos do check-out confirmado. Marco único (prazos.ts e caucao.ts). */
export const tetoExternoDevolucao = (checkoutConfirmado: string): string => addDiasCorridos(checkoutConfirmado, PRAZO_REEMBOLSO_DIAS);

/**
 * Caução sugerida para imóvel mobiliado: ~10% do valor dos móveis, com TETO de
 * 30% do total da estadia. A plataforma só sugere — o valor é acordado e fica
 * em poupança da caução, nunca com a plataforma.
 *
 * @deprecated A caução passou a ser 50% de cada bloco, com a soma limitada a
 * 3 aluguéis (caucaoDoBloco, lib/contrato-blocos). Mantida só como histórico.
 */
export function calcularCaucaoSugerida(valorMoveis: number, valorTotalEstadia: number): number {
  const base = Math.round(Math.max(0, valorMoveis) * PERC_MOVEIS);
  const teto = Math.round(Math.max(0, valorTotalEstadia) * TETO_ESTADIA);
  return Math.min(base, teto);
}

/** Fração da caução sobre o valor total do período (Onda 1: 50%). */
export const PERC_CAUCAO = REGRAS_CONTRATO.caucaoFracaoBloco; // fonte única: config/planos

/*
  A caução do contrato é calculada por BLOCO em lib/contrato-blocos.ts
  (caucaoDoBloco): 50% de cada bloco, com a soma limitada a 3 aluguéis
  (art. 38, §2º). Não há outra conta de caução.
*/

/** Valor de cada parcela no cartão (arredondado). Para de 1 a MAX_PARCELAS. */
export function valorParcela(total: number, parcelas: number): number {
  const n = Math.min(Math.max(1, Math.floor(parcelas)), MAX_PARCELAS);
  return Math.round(total / n);
}

/**
 * Destino do valor conforme a forma de pagamento — NUNCA a plataforma:
 * à vista → poupança da caução (em nome do locador); parcelado → emissor do cartão.
 */
export function destinoValor(forma: FormaPagamentoCaucao): DestinoValor {
  return forma === "parcelado" ? "emissor" : "conta_vinculada";
}

/** Soma dos descontos comprovados (ignora valores negativos). */
export function totalDescontos(descontos: DescontoReembolso[]): number {
  return descontos.reduce((s, d) => s + Math.max(0, d.valor), 0);
}

/**
 * Valor a devolver = caução − descontos comprovados, nunca negativo. É só o
 * cálculo do que o LOCADOR deve devolver (da poupança da caução direto ao
 * inquilino); a plataforma documenta, não paga.
 */
export function calcularReembolso(caucao: number, descontos: DescontoReembolso[]): number {
  return Math.max(0, caucao - totalDescontos(descontos));
}

/**
 * E707 — prazo limite que o simulador de reembolso mostra. Com a trava dos prazos da caução DESLIGADA, é o de sempre (30 dias a
 * partir de hoje). Ligada, é o teto externo contado do check-out confirmado (marco único) — e sem check-out válido, nenhum prazo.
 */
export function prazoLimiteDoReembolso(e: { prazosAtivos: boolean; hoje: string; checkout: string }): string | null {
  if (!e.prazosAtivos) return addDiasCorridos(e.hoje, PRAZO_REEMBOLSO_DIAS);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.checkout) || Number.isNaN(Date.parse(`${e.checkout}T00:00:00Z`))) return null;
  return tetoExternoDevolucao(e.checkout);
}
