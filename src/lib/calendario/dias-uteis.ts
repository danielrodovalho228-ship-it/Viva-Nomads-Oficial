/*
  E948 — a contagem ÚNICA de dias úteis (horário de Brasília), sobre o calendário de feriados-nacionais.ts.
  Começando num dia útil, cada dia útil soma 1 e o resultado sai na MESMA hora do dia. Começando em dia não útil (fim de
  semana ou feriado nacional), a contagem começa no próximo dia útil às 00h. PURO.
*/
import { ehDiaUtil } from "./feriados-nacionais.ts";

const H = 3_600_000;
const DIA = 24 * H;
/** Brasília: UTC−3 (sem horário de verão desde 2019). */
export const BRT = -3 * H;

/** O dia (AAAA-MM-DD) de um instante, em Brasília. */
export function diaBRT(t: number | Date): string {
  return new Date((typeof t === "number" ? t : t.getTime()) + BRT).toISOString().slice(0, 10);
}

/** 00h (Brasília) do dia do instante. */
function meiaNoiteBRT(t: number): number {
  return Math.floor((t + BRT) / DIA) * DIA - BRT;
}

/** O instante é dia útil (Brasília)? */
export function instanteEmDiaUtil(t: number | Date): boolean {
  return ehDiaUtil(diaBRT(t));
}

export function somarDiasUteis(inicio: Date, n: number): Date {
  let t = inicio.getTime();
  if (!instanteEmDiaUtil(t)) {
    t = meiaNoiteBRT(t) + DIA;
    while (!instanteEmDiaUtil(t)) t += DIA;
  }
  for (let i = 0; i < n; i++) {
    t += DIA;
    while (!instanteEmDiaUtil(t)) t += DIA;
  }
  return new Date(t);
}
