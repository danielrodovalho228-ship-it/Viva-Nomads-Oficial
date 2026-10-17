/*
  Editor de anúncio — etapas (prompt 10: cadastro em 5 etapas, aprovado pelo Daniel em 17/10).
  0 Onde fica · 1 Fotos · 2 O que encontramos · 3 Preço e disponibilidade · 4 Revisar e publicar.
  Voltar e pular para etapas JÁ VISITADAS é livre; avançar para uma etapa nova só pelo "Continuar" (que valida).
  A etapa mais avançada fica no rascunho, para a retomada não travar o que a pessoa já tinha percorrido.
  Rascunhos das ordens antigas (7 etapas) abrem na PRIMEIRA etapa ainda incompleta. PURO.
*/
import { MIN_FOTOS } from "./anuncio/prontidao.ts";

export const ETAPAS = ["onde", "fotos", "encontramos", "preco", "revisar"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Ordem das etapas (os IDs já seguem a ordem). */
export const ORDEM_ETAPAS = [0, 1, 2, 3, 4] as const;
export const ULTIMA_ETAPA = ORDEM_ETAPAS.length - 1;
/** Versão da ordem gravada no rascunho: 3 = 5 etapas (1 = 7 em sequência; 2 = 7 com "fotos primeiro"). */
export const VERSAO_ORDEM_ETAPAS = 3;

export function etapaMaisAvancada(anterior: number, ...atuais: number[]): number {
  return Math.max(anterior, ...atuais.filter((n) => Number.isFinite(n)));
}

export function etapaLiberada(i: number, atual: number, maisAvancada: number): boolean {
  return i <= Math.max(atual, maisAvancada);
}

/** Lê a etapa mais avançada de um rascunho salvo (antigos não têm: vale a etapa atual). */
export function etapaMaxDoRascunho(d: { step?: unknown; etapaMax?: unknown }, ultima: number): number {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(ultima, Math.max(0, Math.round(v))) : 0);
  return Math.max(n(d.step), n(d.etapaMax));
}

/** Posição de uma etapa (= o próprio ID nas 5 etapas); id desconhecido cai na primeira. */
export function posicaoDaEtapa(id: number): number {
  return (ORDEM_ETAPAS as readonly number[]).includes(id) ? id : 0;
}

/** ID da etapa numa posição (limitada ao intervalo válido). */
export function etapaNaPosicao(pos: number): number {
  return Math.min(ULTIMA_ETAPA, Math.max(0, Math.round(Number.isFinite(pos) ? pos : 0)));
}

/** O que um rascunho tem preenchido — para achar a primeira etapa ainda incompleta. */
export interface CamposRascunho {
  street?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  photos?: unknown;
  bathrooms?: unknown;
  areaM2?: unknown;
  maxGuests?: unknown;
  title?: unknown;
  monthlyPrice?: unknown;
  garantias?: unknown;
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => Number(typeof v === "string" || typeof v === "number" ? v : 0) || 0;

/** Primeira etapa ainda incompleta de um rascunho (Revisar quando está tudo preenchido). */
export function primeiraEtapaIncompleta(d: CamposRascunho): number {
  if (!txt(d.street) || !txt(d.neighborhood) || !txt(d.city)) return 0;
  if (!Array.isArray(d.photos) || d.photos.length < MIN_FOTOS) return 1;
  if (num(d.bathrooms) < 1 || num(d.areaM2) <= 0 || num(d.maxGuests) < 1 || txt(d.title).length < 3) return 2;
  const garantia = !!d.garantias && typeof d.garantias === "object" && Object.values(d.garantias as Record<string, unknown>).some(Boolean);
  if (num(d.monthlyPrice) <= 0 || !garantia) return 3;
  return 4;
}

/** Etapa (ID) de um rascunho: na ordem atual vale a gravada; nas antigas, a primeira etapa incompleta. */
export function etapaDoRascunho(d: CamposRascunho & { step?: unknown; ordemEtapas?: unknown }): number {
  if (d.ordemEtapas !== VERSAO_ORDEM_ETAPAS) return primeiraEtapaIncompleta(d);
  const s = d.step;
  if (typeof s !== "number" || !Number.isFinite(s)) return 0;
  const id = Math.round(s);
  return (ORDEM_ETAPAS as readonly number[]).includes(id) ? id : 0;
}

/** Posição mais avançada já visitada. Rascunho antigo: a etapa em que ele reabre (a primeira incompleta). */
export function posMaxDoRascunho(d: CamposRascunho & { step?: unknown; etapaMax?: unknown; ordemEtapas?: unknown }): number {
  const atual = etapaDoRascunho(d);
  if (d.ordemEtapas !== VERSAO_ORDEM_ETAPAS) return atual;
  const max = typeof d.etapaMax === "number" && Number.isFinite(d.etapaMax) ? Math.min(ULTIMA_ETAPA, Math.max(0, Math.round(d.etapaMax))) : 0;
  return Math.max(atual, max);
}

/** Etapa (ID) pedida em `?etapa=` (link do checklist da Visão geral); inválida = null. */
export function etapaDaUrl(v: string | null | undefined): number | null {
  if (typeof v !== "string" || !/^[0-4]$/.test(v)) return null;
  return Number(v);
}
