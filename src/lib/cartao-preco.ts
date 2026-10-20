/*
  Preço do cartão de anúncio (QA do Muse no Prompt 40) — PURO.
  Formato: "R$ X/mês · R$ Y em N meses". X é o total do mês (valor mensal + condomínio + consumo fixo,
  a fonte única de precos.ts, o mesmo número do pino do mapa). N = duração da busca ou, sem busca, a
  estadia mínima do imóvel. Com N = 1, só "R$ X/mês".
*/
import { formatBRL } from "./utils.ts";

/** Meses do total da estadia: a duração da busca ou, sem busca, a estadia mínima do imóvel. */
export function mesesDoCartao(periodMonths: number | undefined, minPeriodDays: number | undefined): number {
  if (periodMonths && periodMonths > 0) return periodMonths;
  return Math.max(1, Math.ceil((minPeriodDays ?? 30) / 30));
}

/** Partes do rótulo: `valor` = "R$ X"; `mes` = "R$ X/mês"; `estadia` = "R$ Y em N meses" (null quando N = 1). */
export function rotuloPrecoCartao(totalMes: number, meses: number): { valor: string; mes: string; estadia: string | null } {
  const valor = formatBRL(totalMes);
  const mes = `${valor}/mês`;
  if (meses <= 1) return { valor, mes, estadia: null };
  return { valor, mes, estadia: `${formatBRL(totalMes * meses)} em ${meses} meses` };
}

/** O rótulo inteiro numa linha: "R$ X/mês · R$ Y em N meses" (ou só "R$ X/mês"). */
export function textoPrecoCartao(totalMes: number, meses: number): string {
  const r = rotuloPrecoCartao(totalMes, meses);
  return r.estadia ? `${r.mes} · ${r.estadia}` : r.mes;
}
