/*
  E562 (E-DIAS) — estadia em DIAS exatos (30 a 180) e preço proporcional. A REGRA ÚNICA do total da estadia, usada pela
  proposta (calcularTotais / precoDaProposta), pela taxa da Viva e pelos blocos do contrato (caução).

  • Total da estadia = Total por mês × dias ÷ 30. Aluguel, condomínio, contas (consumo) e taxa pet entram pela mesma
    regra, proporcionais aos dias.
  • A limpeza única (preparação/saída) fica INTEIRA.
  • Pacote de limpezas = round(limpezas por mês × dias ÷ 30) — o dono pode ajustar o número na proposta.
  • Taxa da Viva = taxa × aluguel × dias ÷ 30 (a base continua sendo o aluguel, como na fórmula única da cobrança).
  • Bloco = estadia de até 90 dias (art. 48); caução = 50% do valor do bloco (aluguel × dias do bloco ÷ 30), com o teto
    de 3 aluguéis no contrato.
  • "Meses" vira referência derivada: ceil(dias ÷ 30). Em meses cheios (dias múltiplo de 30) tudo dá o mesmo de antes.
*/
import { REGRAS_CONTRATO } from "../config/planos.ts";
import { comissaoSobreDias } from "./cobranca/regra.ts";

/** Dias por "mês" da regra comercial (30). */
export const DIAS_DO_MES = REGRAS_CONTRATO.diasPorMes;
/** Estadia mínima e máxima, em dias. */
export const DIAS_MIN_ESTADIA = 30;
export const DIAS_MAX_ESTADIA = REGRAS_CONTRATO.prazoMaxDias;
/** Teto legal do bloco (temporada, art. 48 da Lei 8.245/91). */
export const DIAS_MAX_BLOCO = REGRAS_CONTRATO.maxDiasBloco;

const centavos = (v: number) => Math.round(v * 100) / 100;
const pos = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

/** Dias de estadia aceitos: inteiro entre 30 e 180. */
export function diasValidos(dias: unknown): boolean {
  const d = Number(dias);
  return Number.isInteger(d) && d >= DIAS_MIN_ESTADIA && d <= DIAS_MAX_ESTADIA;
}

/** Meses de REFERÊNCIA de uma estadia em dias (para cima): 30→1, 43→2, 90→3, 91→4. */
export function mesesDeReferencia(dias: number): number {
  return Math.max(1, Math.ceil(pos(dias) / DIAS_DO_MES));
}

/** Meses COMPLETOS da estadia (para baixo): 43→1. Usado nas faixas de desconto por estadia longa. */
export function mesesCompletos(dias: number): number {
  return Math.max(1, Math.floor(pos(dias) / DIAS_DO_MES));
}

/** Um valor mensal proporcional aos dias: valor × dias ÷ 30, em centavos. */
export function proporcional(valorMensal: number, dias: number): number {
  return centavos((pos(valorMensal) * Math.round(pos(dias))) / DIAS_DO_MES);
}

/** Pacote de limpezas da estadia: round(limpezas por mês × dias ÷ 30). */
export function limpezasDoPacote(limpezasMes: number, dias: number): number {
  return Math.round((Math.round(pos(limpezasMes)) * Math.round(pos(dias))) / DIAS_DO_MES);
}

export interface EntradaEstadiaDias {
  dias: number;
  /** Aluguel do mês (já com desconto). */
  mensal: number;
  condominio?: number;
  consumo?: number;
  taxaPet?: number;
  limpezasMes?: number;
  valorLimpeza?: number;
  /** Ajuste do dono: número de limpezas do pacote. Vazio = round(limpezas por mês × dias ÷ 30). */
  limpezasPacote?: number | null;
  /** Limpeza única (preparação/saída): entra inteira. */
  limpezaUnica?: number;
}

export interface TotalEstadiaDias {
  dias: number;
  mesesReferencia: number;
  /** Aluguel + condomínio + contas + taxa pet de UM mês (sem as limpezas). */
  recorrenteMes: number;
  /** recorrenteMes × dias ÷ 30. */
  recorrenteProporcional: number;
  /** Só o aluguel × dias ÷ 30 — a base da taxa da Viva e do bloco. */
  aluguelProporcional: number;
  limpezasPacote: number;
  valorPacote: number;
  limpezaUnica: number;
  total: number;
}

/** O total da estadia em dias — a regra única (ver o cabeçalho). */
export function totalDaEstadia(e: EntradaEstadiaDias): TotalEstadiaDias {
  const dias = Math.round(pos(e.dias));
  const recorrenteMes = centavos(pos(e.mensal) + pos(e.condominio) + pos(e.consumo) + pos(e.taxaPet));
  const recorrenteProporcional = proporcional(recorrenteMes, dias);
  const limpezasPacote =
    e.limpezasPacote != null && Number.isFinite(Number(e.limpezasPacote)) ? Math.round(pos(e.limpezasPacote)) : limpezasDoPacote(pos(e.limpezasMes), dias);
  const valorPacote = centavos(limpezasPacote * pos(e.valorLimpeza));
  const limpezaUnica = centavos(pos(e.limpezaUnica));
  return {
    dias,
    mesesReferencia: mesesDeReferencia(dias),
    recorrenteMes,
    recorrenteProporcional,
    aluguelProporcional: proporcional(e.mensal, dias),
    limpezasPacote,
    valorPacote,
    limpezaUnica,
    total: centavos(recorrenteProporcional + valorPacote + limpezaUnica),
  };
}

/** Taxa da Viva sobre o valor proporcional: taxa × aluguel × dias ÷ 30. */
export function taxaSobreDias(aluguelMensal: number, dias: number, taxa: number): number {
  return comissaoSobreDias(aluguelMensal, dias, taxa);
}

export interface BlocoEmDias {
  numero: number;
  dias: number;
  /** Meses de referência do bloco (ceil(dias ÷ 30), 1..3) — a coluna contrato_blocos.meses. */
  meses: number;
  /** Aluguel × dias do bloco ÷ 30. */
  valor: number;
  /** 50% do valor do bloco, limitada ao teto de 3 aluguéis no contrato. */
  caucao: number;
  desembolso: number;
}

/** Caução do bloco: 50% do valor, limitada ao que falta para a soma chegar a 3 aluguéis (art. 38 §2º). */
function caucaoDoBlocoDias(valorBloco: number, aluguelMensal: number, jaExigida: number): number {
  const teto = Math.max(0, aluguelMensal * REGRAS_CONTRATO.caucaoMaxAlugueis - Math.max(0, jaExigida));
  return Math.min(Math.round(Math.max(0, valorBloco) * REGRAS_CONTRATO.caucaoFracaoBloco), Math.round(teto));
}

/**
 * Divide a estadia (em dias) em blocos de até `tamanhoDias` (no máximo 90), o último com o resto:
 * 90 → [90]; 91 → [90, 1]; 180 → [90, 90]; 43 → [43].
 */
export function blocosEmDias(diasTotal: number, aluguelMensal: number, tamanhoDias: number = DIAS_MAX_BLOCO): BlocoEmDias[] {
  const total = Math.max(1, Math.round(pos(diasTotal)));
  const aluguel = pos(aluguelMensal);
  const passo = Math.min(Math.max(1, Math.round(pos(tamanhoDias))), DIAS_MAX_BLOCO);
  const blocos: BlocoEmDias[] = [];
  let restante = total;
  let numero = 1;
  let acumulada = 0;
  while (restante > 0) {
    const dias = Math.min(passo, restante);
    const valor = proporcional(aluguel, dias);
    const caucao = caucaoDoBlocoDias(valor, aluguel, acumulada);
    acumulada += caucao;
    blocos.push({ numero, dias, meses: mesesDeReferencia(dias), valor, caucao, desembolso: centavos(valor + caucao) });
    restante -= dias;
    numero += 1;
  }
  return blocos;
}
