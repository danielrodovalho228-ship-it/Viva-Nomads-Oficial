/**
 * Apresentação do parceiro (bloco parceiro do Muse, 31/10 — E298, E300, E306): a mesma regra no cartão da busca e no
 * detalhe. Puro (node --test).
 */
import { fotoDaCategoria } from "../../config/fotos-categorias-parceiro.ts";

/**
 * E300: as iniciais do nome público — a 1ª letra das duas primeiras palavras, ignorando o que não é letra (prefixos
 * como "[TESTE QA]", números, emojis, pontuação). Nunca "[" nem vazio: sem letra nenhuma, "?".
 */
export function iniciaisDoParceiro(nome: string): string {
  const semMarcadores = nome.replace(/\[[^\]]*\]|\([^)]*\)/g, " ");
  const palavras = semMarcadores.match(/\p{L}[\p{L}'’-]*/gu) ?? nome.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  const ini = palavras.slice(0, 2).map((p) => p[0]!.toLocaleUpperCase("pt-BR")).join("");
  return ini || "?";
}

export type CapaParceiro = { src: string; alt: string; origem: "capa" | "foto" | "categoria" } | null;

/**
 * E298 + E306: a capa nunca é uma área vazia. Ordem: a capa que o parceiro enviou → a foto dele → a foto da categoria
 * principal. Sem nenhuma das três (categoria sem foto), null.
 */
export function capaDoParceiro(p: { nomePublico: string; bannerUrl: string | null; avatarUrl: string | null; categorias: readonly string[] }): CapaParceiro {
  if (p.bannerUrl) return { src: p.bannerUrl, alt: `Capa de ${p.nomePublico}`, origem: "capa" };
  if (p.avatarUrl) return { src: p.avatarUrl, alt: `Foto de ${p.nomePublico}`, origem: "foto" };
  for (const c of p.categorias) {
    const f = fotoDaCategoria(c);
    if (f) return { src: f.src, alt: f.alt, origem: "categoria" };
  }
  return null;
}

/** E299: o selo que todo parceiro publicado tem (passou pela aprovação da Viva) — o mesmo texto no cartão e no detalhe. */
export const SELO_APROVADO = "Aprovado pela Viva";
