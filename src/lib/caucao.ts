/*
  Caução flexível + política de reembolso — regras PURAS (sem efeito colateral).

  Princípio inegociável (regra de ouro): a plataforma conecta, verifica,
  documenta e registra — NUNCA recebe, retém nem transfere o valor. Por isso
  aqui só há CÁLCULO e REGISTRO. O dinheiro vai para a conta vinculada (em nome
  do locador) ou para a instituição emissora (no parcelado) — nunca para a
  plataforma. O reembolso é PAGO pelo locador; a plataforma só documenta.
*/

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
/** Prazo legal de devolução após a entrega das chaves. */
export const PRAZO_REEMBOLSO_DIAS = 30;

/**
 * Caução sugerida para imóvel mobiliado: ~10% do valor dos móveis, com TETO de
 * 30% do total da estadia. A plataforma só sugere — o valor é acordado e fica
 * em conta vinculada, nunca com a plataforma.
 *
 * @deprecated Onda 1 (Dra. Beatriz): a caução passou a ser 50% do valor total
 * do período (ver `calcularCaucao50`). Mantida para referência/histórico.
 */
export function calcularCaucaoSugerida(valorMoveis: number, valorTotalEstadia: number): number {
  const base = Math.round(Math.max(0, valorMoveis) * PERC_MOVEIS);
  const teto = Math.round(Math.max(0, valorTotalEstadia) * TETO_ESTADIA);
  return Math.min(base, teto);
}

/** Fração da caução sobre o valor total do período (Onda 1: 50%). */
export const PERC_CAUCAO = 0.5;

/**
 * Caução da Onda 1 (Dra. Beatriz): 50% do VALOR TOTAL do período locado,
 * independentemente do prazo (30 ou 180 dias). Ex.: período de R$ 6.000 →
 * caução de R$ 3.000. A plataforma apenas calcula e documenta — o valor vai
 * para conta vinculada/instituição, NUNCA para a plataforma.
 */
export function calcularCaucao50(valorTotalPeriodo: number): number {
  return Math.round(Math.max(0, valorTotalPeriodo) * PERC_CAUCAO);
}

/** Valor de cada parcela no cartão (arredondado). Para de 1 a MAX_PARCELAS. */
export function valorParcela(total: number, parcelas: number): number {
  const n = Math.min(Math.max(1, Math.floor(parcelas)), MAX_PARCELAS);
  return Math.round(total / n);
}

/**
 * Destino do valor conforme a forma de pagamento — NUNCA a plataforma:
 * à vista → conta vinculada (em nome do locador); parcelado → emissor do cartão.
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
 * cálculo do que o LOCADOR deve devolver (da conta vinculada direto ao
 * inquilino); a plataforma documenta, não paga.
 */
export function calcularReembolso(caucao: number, descontos: DescontoReembolso[]): number {
  return Math.max(0, caucao - totalDescontos(descontos));
}
