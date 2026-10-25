/*
  Agenda do proprietário (prompt 23, item 5) — Ferramentas › Agenda. Regras puras (a página e os testes usam as mesmas):
  visitas (vídeo e presencial), entradas e saídas das estadias e datas bloqueadas, de todos os imóveis, por dia no
  horário de Brasília. Nome curto e foto do inquilino só depois do aceite (o servidor já manda null antes).

  AGENDA-A (E83): a estadia vira um item de PERÍODO (faixa contínua do início ao fim, com a entrada e a saída
  marcadas), o bloqueio pinta todos os dias do período e cada dia diz o que dá para fazer nele (`acaoDoDia`).
*/

export type TipoAgenda = "visita" | "entrada" | "saida" | "bloqueio" | "estadia";

export interface ItemAgenda {
  id: string;
  tipo: TipoAgenda;
  propertyId: string;
  imovel: string;
  /** Instante (visita, ISO com hora) ou dia (AAAA-MM-DD) das entradas, saídas e bloqueios. */
  quando: string;
  /** Bloqueio e estadia: último dia (AAAA-MM-DD). */
  ate?: string | null;
  /** Bloqueio: "importado" veio do calendário de outro site (só a sincronia tira); "manual" o dono bloqueou. */
  origem?: "manual" | "importado";
  /** Visita: o que as ações do dia precisam (as mesmas de /dashboard/visitas). */
  visita?: VisitaDaAgenda;
  /** Visita: "video" | "presencial" e o status (Pedida / Confirmada / Remarcar). */
  modalidade?: "video" | "presencial";
  status?: string;
  /** Só depois do aceite (nome curto + foto); antes, null. */
  pessoa?: { nome: string; fotoUrl: string | null } | null;
  /** Para onde o clique leva (a visita ou a locação). */
  href: string | null;
}

export interface VisitaDaAgenda {
  id: string;
  horarios: string[];
  horarioConfirmado: string | null;
  horarioProposto: string | null;
}

export const ROTULO_TIPO_AGENDA: Record<TipoAgenda, string> = {
  visita: "Visita",
  entrada: "Entrada",
  saida: "Saída",
  bloqueio: "Bloqueado",
  estadia: "Estadia",
};

/** Legenda fixa sob a grade, nesta ordem (cor + ícone na tela). */
export const LEGENDA_AGENDA = ["Estadia", "Entrada", "Saída", "Bloqueado", "Visita", "Visita a confirmar"] as const;

/** Visita ainda sem horário fechado: pedida (o dono não respondeu) ou com outro horário proposto (o interessado não aceitou). */
export function visitaAConfirmar(i: ItemAgenda): boolean {
  return i.tipo === "visita" && (i.status === "pedido" || i.status === "remarcar");
}

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

const DE_PERIODO: TipoAgenda[] = ["bloqueio", "estadia"];

/** Dias em que o item aparece (bloqueio e estadia ocupam do início ao fim; os demais, um dia só). */
export function diasDoItem(i: ItemAgenda): string[] {
  const ini = diaBrasilia(i.quando);
  if (!ini) return [];
  // Só a parte de data: um "fim" vindo com hora (AAAA-MM-DDT…) não pode encolher o período para o 1º dia.
  const ate = i.ate ? i.ate.slice(0, 10) : null;
  if (!DE_PERIODO.includes(i.tipo) || !ate || !DATA_PURA.test(ate) || ate < ini) return [ini];
  const dias: string[] = [];
  for (let d = ini; d <= ate && dias.length < 400; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export function filtrarPorImovel(itens: ItemAgenda[], propertyId: string | null): ItemAgenda[] {
  return propertyId ? itens.filter((i) => i.propertyId === propertyId) : itens;
}

const ORDEM_TIPO: Record<TipoAgenda, number> = { saida: 0, entrada: 1, estadia: 2, visita: 3, bloqueio: 4 };

/** Itens por dia (AAAA-MM-DD), cada dia em ordem: saída, entrada, estadia, visitas pela hora, bloqueio. */
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

/** O que um dia tem: as estadias (com a ponta de entrada/saída), os bloqueios e as visitas. */
export interface EstadoDoDia {
  estadias: { item: ItemAgenda; entrada: boolean; saida: boolean }[];
  bloqueios: ItemAgenda[];
  visitas: ItemAgenda[];
}

export function estadoDoDia(lista: ItemAgenda[] | undefined, dia: string): EstadoDoDia {
  const itens = lista ?? [];
  return {
    estadias: itens
      .filter((i) => i.tipo === "estadia")
      .map((item) => ({ item, entrada: diaBrasilia(item.quando) === dia, saida: (item.ate ?? "").slice(0, 10) === dia })),
    bloqueios: itens.filter((i) => i.tipo === "bloqueio"),
    visitas: itens.filter((i) => i.tipo === "visita"),
  };
}

/**
 * A ação que o dia oferece (AGENDA-A, item 2). Bloquear e desbloquear pedem um imóvel escolhido no filtro; dia com
 * estadia NUNCA bloqueia (mostra a estadia e o contrato); dia passado não bloqueia. Nunca só "nada marcado".
 */
export type AcaoDoDia = "escolher-imovel" | "bloquear" | "desbloquear" | "estadia" | "passado";

export function acaoDoDia(estado: EstadoDoDia, dia: string, hoje: string, imovelEscolhido: boolean): AcaoDoDia {
  if (estado.estadias.length) return "estadia";
  if (!imovelEscolhido) return "escolher-imovel";
  if (estado.bloqueios.length) return "desbloquear";
  if (dia < hoje) return "passado";
  return "bloquear";
}

/** O período a bloquear não pode encostar numa estadia (contrato): devolve o 1º dia que conflita, ou null. */
export function conflitoComEstadia(itens: ItemAgenda[], propertyId: string, inicio: string, fim: string): string | null {
  for (const i of itens) {
    if (i.tipo !== "estadia" || i.propertyId !== propertyId) continue;
    const dias = diasDoItem(i);
    const choque = dias.find((d) => d >= inicio && d <= fim);
    if (choque) return choque;
  }
  return null;
}

const MESES_TITULO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "Outubro de 2026" (só o mês com inicial maiúscula; nada de "De"). mes = 1..12. */
export function tituloDoMes(ano: number, mes: number): string {
  return `${MESES_TITULO[mes - 1]} de ${ano}`;
}

/** O mês mostrado tem algum item? (sem itens, a grade usa células menores). */
export function mesTemItens(porDia: Map<string, ItemAgenda[]>, ano: number, mes: number): boolean {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}-`;
  for (const [d, l] of porDia) if (d.startsWith(prefixo) && l.length) return true;
  return false;
}
