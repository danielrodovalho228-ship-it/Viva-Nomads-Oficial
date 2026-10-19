/*
  Nenhum período sobreposto no mesmo imóvel (complemento do coordenador, 19/10) — regra por DATAS, não por contagem.
  Dois contratos ativos (assinando, aguardando pagamento ou em vigência) do mesmo imóvel não podem ter períodos que se
  cruzam; o sequencial (entrada no dia seguinte ao fim do outro) é permitido. O banco garante (0175: EXCLUDE em
  contratos.periodo); estas funções puras dão a mensagem antes, no aceite e no "Gerar contrato".
*/
import { DIAS_POR_MES, fimInclusivoISO } from "./contrato-blocos.ts";

export interface Periodo {
  inicio: string; // AAAA-MM-DD
  fim: string; // AAAA-MM-DD, inclusivo
}

/** Período de uma estadia de `meses` a partir da entrada (mesma conta dos blocos: meses × 30 dias, fim inclusivo). */
export function periodoDaEstadia(entradaISO: string, meses: number): Periodo {
  const m = Math.max(1, Math.round(Number(meses) || 1));
  return { inicio: entradaISO, fim: fimInclusivoISO(entradaISO, m * DIAS_POR_MES) };
}

/**
 * Lê o daterange do Postgres ("[2026-10-19,2026-12-18)" — forma canônica, fim exclusivo) e devolve o fim INCLUSIVO.
 * null para vazio ou inválido.
 */
export function lerDaterange(v: unknown): Periodo | null {
  const m = /^([[(])(\d{4}-\d{2}-\d{2})?,(\d{4}-\d{2}-\d{2})?([\])])$/.exec(String(v ?? "").trim());
  if (!m || !m[2] || !m[3]) return null;
  const inicio = m[1] === "[" ? m[2] : somaDias(m[2], 1);
  const fim = m[4] === "]" ? m[3] : somaDias(m[3], -1);
  return fim < inicio ? null : { inicio, fim };
}

function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Os dois períodos têm ao menos um dia em comum (fins inclusivos). */
export function sobrepoe(a: Periodo, b: Periodo): boolean {
  return a.inicio <= b.fim && b.inicio <= a.fim;
}

/** O primeiro período ocupado que cruza o pedido (por data de início), ou null. */
export function conflitoDePeriodo(pedido: Periodo, ocupados: Periodo[]): Periodo | null {
  return [...ocupados].sort((x, y) => x.inicio.localeCompare(y.inicio)).find((o) => sobrepoe(pedido, o)) ?? null;
}

const br = (iso: string) => iso.split("-").reverse().join("/");

export function mensagemConflitoPeriodo(c: Periodo): string {
  return `Este imóvel já tem contrato de ${br(c.inicio)} a ${br(c.fim)}. Escolha outra data de entrada.`;
}

/** Status de contrato que ocupa o imóvel (o mesmo filtro do EXCLUDE da 0175). */
export const STATUS_OCUPA_IMOVEL = "ativo";

/** Código do Postgres para a violação do EXCLUDE (dois contratos ativos sobrepostos). */
export const ERRO_SOBREPOSICAO_PG = "23P01";
