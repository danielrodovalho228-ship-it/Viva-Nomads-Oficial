/*
  E679 — PR 4: avaliações nos perfis públicos (mockups avaliacoes-perfil-proprietario e -perfil-parceiro). O "Resumo das
  notas": a média de cada critério fixo do par, só entre quem avaliou aquele critério. Puro.
*/
import { CRITERIOS, type ParAvaliacao } from "./avaliacoes-criterios.ts";

export interface NotaDoCriterio {
  chave: string;
  rotulo: string;
  /** Média com 1 decimal; null quando ninguém avaliou o critério (a barra não inventa 0). */
  media: number | null;
  n: number;
}

const valida = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5;

/** Média por critério, na ordem do par. Ignora nota fora de 1 a 5 e chave de outro par. */
export function resumoDasNotas(par: ParAvaliacao, linhas: ReadonlyArray<Record<string, unknown> | null | undefined>): NotaDoCriterio[] {
  return CRITERIOS[par].map((c) => {
    const notas = linhas.map((l) => l?.[c.chave]).filter(valida);
    const n = notas.length;
    const media = n ? Math.round((notas.reduce((s, x) => s + x, 0) / n) * 10) / 10 : null;
    return { chave: c.chave, rotulo: c.rotulo, media, n };
  });
}

/** "4,9" / "5,0" (pt-BR, sempre uma casa). */
export const notaPorExtenso = (n: number): string => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Aviso da página pública do parceiro: a nota que ele dá ao cliente é só entre parceiros. */
export const TEXTO_NOTAS_ENTRE_PARCEIROS = (nome: string) => `As notas que a ${nome} dá aos clientes são visíveis só entre parceiros e não aparecem aqui.`;
