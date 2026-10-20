/*
  Formatador ÚNICO de data e hora do admin (Prompt 29, item 11). Todo horário mostrado à equipe sai no horário de
  Brasília e diz isso: "19/10/2026 14:32 (horário de Brasília)" no texto, "19/10/2026 14:32 BRT" em tabela.
  Puro (node --test). Data inválida ou vazia → "—".
*/

export const FUSO_BRASILIA = "America/Sao_Paulo";
export const ETIQUETA_BRASILIA = "horário de Brasília";

function paraData(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

const partes = (d: Date) => {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { dia: v("day"), mes: v("month"), ano: v("year"), hora: v("hour"), min: v("minute") };
};

/** "19/10/2026" no calendário de Brasília. */
export function dataBRT(d: Date | string | number | null | undefined): string {
  const x = paraData(d);
  if (!x) return "—";
  const p = partes(x);
  return `${p.dia}/${p.mes}/${p.ano}`;
}

/** "14:32" no horário de Brasília. */
export function horaBRT(d: Date | string | number | null | undefined): string {
  const x = paraData(d);
  if (!x) return "—";
  const p = partes(x);
  return `${p.hora}:${p.min}`;
}

/**
 * "19/10/2026 14:32 (horário de Brasília)"; com `tabela`, "19/10/2026 14:32 BRT"; com `semEtiqueta`, só a data e a
 * hora (quando a etiqueta já está no cabeçalho da coluna ou da página).
 */
export function dataHoraBRT(d: Date | string | number | null | undefined, opts: { tabela?: boolean; semEtiqueta?: boolean } = {}): string {
  const x = paraData(d);
  if (!x) return "—";
  const p = partes(x);
  const base = `${p.dia}/${p.mes}/${p.ano} ${p.hora}:${p.min}`;
  if (opts.semEtiqueta) return base;
  return opts.tabela ? `${base} BRT` : `${base} (${ETIQUETA_BRASILIA})`;
}

/** "2026-10-19" — o dia no calendário de Brasília (para comparar e ordenar; nunca o dia em UTC). */
export function diaBRT(d: Date | string | number | null | undefined): string | null {
  const x = paraData(d);
  if (!x) return null;
  const p = partes(x);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** Diferença (min) entre o relógio de Brasília e o UTC no instante dado (−180 hoje; respeita horário de verão antigo). */
function deslocamentoBRT(x: Date): number {
  const p = partes(x);
  const comoUtc = Date.UTC(Number(p.ano), Number(p.mes) - 1, Number(p.dia), Number(p.hora), Number(p.min));
  return Math.round((comoUtc - Math.floor(x.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * O INSTANTE em que o relógio de Brasília marca `dia` (AAAA-MM-DD) às `hora` (HH:MM). Não depende do fuso do
 * servidor nem do navegador. Entrada inválida → null.
 */
export function instanteBRT(dia: string, hora = "00:00"): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  const h = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!d || !h) return null;
  const comoUtc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(h[1]), Number(h[2]));
  if (Number.isNaN(comoUtc)) return null;
  // 1º palpite com o deslocamento daquele momento; 2º passo acerta a virada de horário de verão.
  let t = comoUtc - deslocamentoBRT(new Date(comoUtc)) * 60_000;
  t = comoUtc - deslocamentoBRT(new Date(t)) * 60_000;
  return new Date(t);
}
