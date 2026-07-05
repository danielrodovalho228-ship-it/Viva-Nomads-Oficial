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

/** Nº de dias entre duas datas ISO (checkOut − checkIn). Negativo se invertido. */
export function diasEntre(aISO: string, bISO: string): number {
  return Math.round((t(bISO) - t(aISO)) / 86400000);
}

/** Soma `n` dias a uma data ISO (yyyy-mm-dd), sem fuso. */
export function addDias(iso: string, n: number): string {
  const d = new Date(t(iso) + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export interface ReservaInput {
  checkIn: string; // ISO
  checkOut: string; // ISO
  fromISO: string; // início efetivo da disponibilidade
  untilISO?: string | null;
  minDias?: number | null;
  maxDias?: number | null;
  bloqueados?: string[]; // dias ISO fechados pelo proprietário
}

export interface ReservaResultado {
  ok: boolean;
  dias: number;
  motivo?: string;
}

/**
 * Valida uma tentativa de reserva contra a janela de disponibilidade, a estadia
 * mínima/máxima e os dias bloqueados. Retorna o nº de dias e, se inválida, o
 * motivo em texto (pronto para exibir).
 */
export function validarReserva(i: ReservaInput): ReservaResultado {
  const min = i.minDias && i.minDias > 0 ? i.minDias : 30;
  const max = i.maxDias && i.maxDias > 0 ? i.maxDias : 180;
  const dias = diasEntre(i.checkIn, i.checkOut);

  if (dias <= 0) return { ok: false, dias, motivo: "A saída deve ser depois da entrada." };
  if (t(i.checkIn) < t(i.fromISO))
    return { ok: false, dias, motivo: "A entrada é antes do início da disponibilidade." };
  if (i.untilISO && t(i.checkOut) > t(i.untilISO))
    return { ok: false, dias, motivo: "A saída passa do fim da disponibilidade." };
  if (dias < min) return { ok: false, dias, motivo: `Estadia mínima de ${min} dias.` };
  if (dias > max) return { ok: false, dias, motivo: `Estadia máxima de ${max} dias.` };

  const bloq = new Set(i.bloqueados ?? []);
  if (bloq.size > 0) {
    // Checa cada noite [checkIn, checkOut).
    for (let d = i.checkIn; t(d) < t(i.checkOut); d = addDias(d, 1)) {
      if (bloq.has(d)) return { ok: false, dias, motivo: "Há dias indisponíveis no período." };
    }
  }
  return { ok: true, dias };
}
