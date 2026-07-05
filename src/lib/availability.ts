/*
  Disponibilidade do imóvel — regras PURAS e testáveis (sem imports @/).

  Base do calendário visual da página do imóvel (estilo FurnishedFinder).
  Trabalha com datas ISO (yyyy-mm-dd) e é determinística — o componente resolve
  "hoje" e passa como início efetivo quando o anúncio não tem data de início.
*/

/** ms de uma data ISO (yyyy-mm-dd) à meia-noite local. */
function t(iso: string): number {
  return Date.parse(`${iso}T00:00:00`);
}

/**
 * Um dia está DISPONÍVEL se cai em [fromISO, untilISO]. Sem `untilISO`, a janela
 * é aberta (disponível de `fromISO` em diante). Bordas incluídas.
 */
export function diaDisponivel(diaISO: string, fromISO: string, untilISO?: string | null): boolean {
  const dia = t(diaISO);
  const from = t(fromISO);
  const until = untilISO ? t(untilISO) : Number.POSITIVE_INFINITY;
  return dia >= from && dia <= until;
}

/** Início efetivo do calendário: a data do anúncio, ou "hoje" se não houver. */
export function inicioEfetivo(fromISO: string | null | undefined, hojeISO: string): string {
  return fromISO && fromISO.length >= 10 ? fromISO.slice(0, 10) : hojeISO;
}

export interface MesRef {
  year: number;
  month: number; // 0..11
}

/** Os `n` meses do calendário a partir do mês da data âncora (ISO). */
export function mesesCalendario(anchorISO: string, n = 3): MesRef[] {
  const y = Number(anchorISO.slice(0, 4));
  const m = Number(anchorISO.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const total = m + i;
    return { year: y + Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  });
}

/** Texto "de N a M dias" da estadia (com padrões 30/180). */
export function estadiaLabel(min?: number | null, max?: number | null): string {
  const mn = min && min > 0 ? min : 30;
  const mx = max && max > 0 ? max : 180;
  return `${mn} a ${mx} dias`;
}
