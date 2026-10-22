/*
  Grade do mês (Prompt 43, item 4) — PURO. Os três calendários da Viva — disponibilidade do imóvel, agenda do
  parceiro e calendário da estadia — usam a MESMA grade e as mesmas marcas; só muda o que cada um marca.
  Datas em "aaaa-mm-dd" (dia de calendário, sem fuso).
  Roda: node --test src/lib/calendario/grade.test.ts
*/

export const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
export const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

/** O que um dia pode ter. A ordem é a de prioridade quando um dia tem mais de uma marca. */
export const MARCAS = ["selecionado", "entrada", "saida", "bloqueado", "evento", "periodo", "hoje"] as const;
export type MarcaDia = (typeof MARCAS)[number];

export const ROTULO_MARCA: Record<MarcaDia, string> = {
  selecionado: "Selecionado",
  entrada: "Entrada",
  saida: "Saída",
  bloqueado: "Bloqueado",
  evento: "Horário combinado",
  periodo: "Estadia",
  hoje: "Hoje",
};

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Células do mês: null nos dias antes do 1º (a semana começa no domingo), depois 1..N. */
export function celulasDoMes(y: number, m: number): (number | null)[] {
  const primeiro = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const dias = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return [...Array<null>(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
}

/** Os N meses a partir do mês de uma data ("aaaa-mm-dd"). */
export function mesesAPartirDe(iso: string, n: number): { ano: number; mes: number }[] {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({ ano: y + Math.floor((m + i) / 12), mes: (m + i) % 12 }));
}

/** Meses entre duas datas (inclusive), no máximo `limite`. */
export function mesesEntre(inicio: string, fim: string, limite = 12): { ano: number; mes: number }[] {
  const a = Number(inicio.slice(0, 4)) * 12 + Number(inicio.slice(5, 7)) - 1;
  const b = Number(fim.slice(0, 4)) * 12 + Number(fim.slice(5, 7)) - 1;
  return mesesAPartirDe(inicio, Math.min(limite, Math.max(1, b - a + 1)));
}

/** Todos os dias de um intervalo fechado (aaaa-mm-dd). */
export function diasDoIntervalo(inicio: string, fim: string): string[] {
  const out: string[] = [];
  const d = new Date(`${inicio}T00:00:00Z`);
  const f = new Date(`${fim}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) return out;
  for (; d <= f && out.length < 800; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

/** Marcas da estadia: o período inteiro, com a entrada e a saída em destaque. */
export function marcasDaEstadia(inicio: string | null, fim: string | null): Record<string, MarcaDia[]> {
  const out: Record<string, MarcaDia[]> = {};
  if (inicio && fim) for (const d of diasDoIntervalo(inicio, fim)) out[d] = ["periodo"];
  if (inicio) out[inicio] = ["entrada", ...(out[inicio] ?? [])];
  if (fim) out[fim] = ["saida", ...(out[fim] ?? [])];
  return out;
}

/** Marca principal de um dia (a de maior prioridade). */
export function marcaPrincipal(marcas: readonly MarcaDia[] | undefined): MarcaDia | null {
  if (!marcas?.length) return null;
  return [...marcas].sort((a, b) => MARCAS.indexOf(a) - MARCAS.indexOf(b))[0];
}
