/*
  E679 — PAINEL AVALIAÇÕES UNIFICADO (mockup avaliacoes-painel, desktop e celular). Resolve a duplicação do E85: um só
  painel, um só nome e um só destino (/dashboard/avaliacoes), para todos os papéis. Regras PURAS; os dados vêm de
  src/lib/data/avaliacoes-painel.ts e de avaliacoes-recebidas.ts. Vocabulário: "avaliações" só entre pessoas; "laudo" é
  a vistoria do avaliador.
*/
import { DIAS_PRAZO_AVALIACAO } from "../avaliacoes.ts";

export const ABAS_PAINEL = [
  { valor: "para-avaliar", rotulo: "Para avaliar" },
  { valor: "recebidas", rotulo: "Recebidas" },
  { valor: "feitas", rotulo: "Feitas" },
] as const;
export type AbaPainel = (typeof ABAS_PAINEL)[number]["valor"];

/** A aba pedida; sem ela (ou inválida), "Para avaliar". Os filtros antigos da Conta (todas/recentes/positivas) são de "Recebidas". */
export function abaDoPainel(v: string | null | undefined): AbaPainel {
  if (ABAS_PAINEL.some((a) => a.valor === v)) return v as AbaPainel;
  if (v === "todas" || v === "recentes" || v === "positivas") return "recebidas";
  return "para-avaliar";
}

/** "Para avaliar (2)" — o número só aparece quando há pendência. */
export function rotuloAba(aba: AbaPainel, paraAvaliar: number): string {
  const base = ABAS_PAINEL.find((a) => a.valor === aba)!.rotulo;
  return aba === "para-avaliar" && paraAvaliar > 0 ? `${base} (${paraAvaliar})` : base;
}

const DIA_MS = 86_400_000;

/** Dias que faltam para avaliar: o prazo é o fim do contrato + 14 dias (migração 0089). Sem data de fim, null. */
export function diasRestantes(encerradoEm: string | null | undefined, agora: Date = new Date()): number | null {
  if (!encerradoEm) return null;
  const fim = Date.parse(encerradoEm);
  if (!Number.isFinite(fim)) return null;
  const prazo = fim + DIAS_PRAZO_AVALIACAO * DIA_MS;
  return Math.max(0, Math.ceil((prazo - agora.getTime()) / DIA_MS));
}

export function rotuloFaltam(dias: number): string {
  if (dias <= 0) return "Último dia";
  return dias === 1 ? "Falta 1 dia" : `Faltam ${dias} dias`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "10 de novembro" (o dia no fuso de Brasília, como o resto do painel). */
export function dataLonga(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 3 * 3_600_000);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export const TEXTO_SIGILO = "As avaliações são secretas: publicam quando os dois lados avaliarem, ou ao fim dos 14 dias.";

export interface ParaAvaliar {
  contratoId: string;
  papel: "morador" | "dono";
  titulo: string;
  encerradoEm: string | null;
  dias: number;
}

type Fonte = { id: string; propertyTitle: string; podeAvaliar: boolean; encerradoEm: string | null };

/**
 * O que ainda dá para avaliar: estadias encerradas dentro da janela, nas duas pontas (como morador e como dono), que a
 * pessoa ainda não avaliou. O que vence antes vem primeiro.
 */
export function paraAvaliarDe({
  locacoes,
  contratos,
  jaAvaliados,
  agora = new Date(),
}: {
  locacoes: Fonte[];
  contratos: Fonte[];
  jaAvaliados: ReadonlySet<string>;
  agora?: Date;
}): ParaAvaliar[] {
  const monta = (lista: Fonte[], papel: ParaAvaliar["papel"]) =>
    lista
      .filter((c) => c.podeAvaliar && !jaAvaliados.has(c.id))
      .map((c) => ({ contratoId: c.id, papel, titulo: c.propertyTitle, encerradoEm: c.encerradoEm, dias: diasRestantes(c.encerradoEm, agora) ?? 0 }));
  return [...monta(locacoes, "morador"), ...monta(contratos, "dono")].sort((a, b) => a.dias - b.dias);
}

/** "há 2 dias" / "hoje" / "ontem", para a linha das recebidas recentes. */
export function haDias(iso: string | null | undefined, agora: Date = new Date()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const n = Math.max(0, Math.floor((agora.getTime() - t) / DIA_MS));
  if (n === 0) return "hoje";
  return n === 1 ? "ontem" : `há ${n} dias`;
}

/** Em que pé está uma avaliação que eu fiz. Nunca diz se a outra parte já enviou (a regra é às cegas). */
export function rotuloStatusFeita(status: string): string {
  if (status === "publicada") return "Publicada";
  if (status === "em_moderacao") return "Em análise pela equipe";
  if (status === "removida") return "Removida pela equipe";
  return "Aguardando a outra parte";
}
