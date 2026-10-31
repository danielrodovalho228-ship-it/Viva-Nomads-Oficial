/*
  Agenda do proprietário (prompt 23, item 5) — Ferramentas › Agenda. Regras puras (a página e os testes usam as mesmas):
  visitas (vídeo e presencial), entradas e saídas das estadias e datas bloqueadas, de todos os imóveis, por dia no
  horário de Brasília. Nome curto e foto do inquilino só depois do aceite (o servidor já manda null antes).
*/

export type TipoAgenda = "visita" | "entrada" | "saida" | "bloqueio";

export interface ItemAgenda {
  id: string;
  tipo: TipoAgenda;
  propertyId: string;
  imovel: string;
  /** Instante (visita, ISO com hora) ou dia (AAAA-MM-DD) das entradas, saídas e bloqueios. */
  quando: string;
  /** Bloqueio: último dia (AAAA-MM-DD). */
  ate?: string | null;
  /** Visita: "video" | "presencial" e o status (Pedida / Confirmada / Remarcar). */
  modalidade?: "video" | "presencial";
  status?: string;
  /** Só depois do aceite (nome curto + foto); antes, null. */
  pessoa?: { nome: string; fotoUrl: string | null } | null;
  /** Para onde o clique leva (a visita ou a locação). */
  href: string | null;
}

export const ROTULO_TIPO_AGENDA: Record<TipoAgenda, string> = {
  visita: "Visita",
  entrada: "Entrada",
  saida: "Saída",
  bloqueio: "Bloqueado",
};

const DATA_PURA = /^\d{4}-\d{2}-\d{2}$/;

/** Dia (AAAA-MM-DD) no horário de Brasília. Data pura fica como está (não vira o dia anterior por fuso). */
export function diaBrasilia(quando: string): string | null {
  if (DATA_PURA.test(quando)) return quando;
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** "14:30" no horário de Brasília (só para itens com hora). */
export function horaBrasilia(quando: string): string | null {
  if (DATA_PURA.test(quando)) return null;
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Dias em que o item aparece (o bloqueio ocupa do início ao fim; os demais, um dia só). */
export function diasDoItem(i: ItemAgenda): string[] {
  const ini = diaBrasilia(i.quando);
  if (!ini) return [];
  if (i.tipo !== "bloqueio" || !i.ate || !DATA_PURA.test(i.ate) || i.ate < ini) return [ini];
  const dias: string[] = [];
  for (let d = ini; d <= i.ate && dias.length < 400; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export function filtrarPorImovel(itens: ItemAgenda[], propertyId: string | null): ItemAgenda[] {
  return propertyId ? itens.filter((i) => i.propertyId === propertyId) : itens;
}

const ORDEM_TIPO: Record<TipoAgenda, number> = { saida: 0, entrada: 1, visita: 2, bloqueio: 3 };

/** Itens por dia (AAAA-MM-DD), cada dia em ordem: saída, entrada, visitas pela hora, bloqueio. */
export function agruparPorDia(itens: ItemAgenda[]): Map<string, ItemAgenda[]> {
  const mapa = new Map<string, ItemAgenda[]>();
  for (const i of itens) for (const d of diasDoItem(i)) mapa.set(d, [...(mapa.get(d) ?? []), i]);
  for (const [d, lista] of mapa) {
    mapa.set(
      d,
      lista.sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || a.quando.localeCompare(b.quando) || a.imovel.localeCompare(b.imovel)),
    );
  }
  return new Map([...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Grade do mês (semanas de domingo a sábado); dias fora do mês vêm com `doMes: false`. mes = 1..12. */
export function gradeDoMes(ano: number, mes: number): { dia: string; doMes: boolean }[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const inicio = somarDias(primeiro.toISOString().slice(0, 10), -primeiro.getUTCDay());
  const semanas: { dia: string; doMes: boolean }[][] = [];
  let d = inicio;
  for (let s = 0; s < 6; s++) {
    const semana: { dia: string; doMes: boolean }[] = [];
    for (let k = 0; k < 7; k++) {
      semana.push({ dia: d, doMes: Number(d.slice(5, 7)) === mes && Number(d.slice(0, 4)) === ano });
      d = somarDias(d, 1);
    }
    if (s >= 4 && !semana.some((x) => x.doMes)) break;
    semanas.push(semana);
  }
  return semanas;
}

/** Mês anterior/seguinte. */
export function moverMes(ano: number, mes: number, delta: number): { ano: number; mes: number } {
  const t = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(t / 12), mes: (t % 12) + 1 };
}

/** Um dia dentro de uma estadia (AGENDA-A): o imóvel e se é a ponta (entrada/saída) ou o meio. */
export interface DiaDeEstadia {
  contrato: string;
  propertyId: string;
  imovel: string;
  ponta: boolean;
}

/**
 * AGENDA-A — o período da estadia pintado em TODOS os dias (não só na entrada e na saída): liga a entrada e a saída do
 * mesmo contrato (ids "entrada-<contrato>" / "saida-<contrato>") e devolve, por dia, as estadias que o ocupam. Sem a
 * saída (ou saída antes da entrada), só a ponta que existe. Teto de 400 dias por estadia.
 */
export function diasEmEstadia(itens: ItemAgenda[]): Map<string, DiaDeEstadia[]> {
  const pontas = new Map<string, { entrada?: ItemAgenda; saida?: ItemAgenda }>();
  for (const i of itens) {
    if (i.tipo !== "entrada" && i.tipo !== "saida") continue;
    const contrato = i.id.replace(/^(entrada|saida)-/, "");
    pontas.set(contrato, { ...pontas.get(contrato), [i.tipo]: i });
  }
  const mapa = new Map<string, DiaDeEstadia[]>();
  const marcar = (dia: string, d: DiaDeEstadia) => mapa.set(dia, [...(mapa.get(dia) ?? []), d]);
  for (const [contrato, { entrada, saida }] of pontas) {
    const base = entrada ?? saida!;
    const ini = entrada ? diaBrasilia(entrada.quando) : null;
    const fim = saida ? diaBrasilia(saida.quando) : null;
    const d = (dia: string, ponta: boolean) => marcar(dia, { contrato, propertyId: base.propertyId, imovel: base.imovel, ponta });
    if (ini && fim && fim >= ini) {
      let n = 0;
      for (let dia = ini; dia <= fim && n < 400; dia = somarDias(dia, 1), n++) d(dia, dia === ini || dia === fim);
    } else {
      if (ini) d(ini, true);
      if (fim) d(fim, true);
    }
  }
  return mapa;
}
