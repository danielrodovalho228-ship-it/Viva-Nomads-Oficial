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

export type CapaParceiro = { src: string; alt: string; origem: "capa" | "galeria" | "foto" | "categoria" } | null;

/**
 * E298 + E306: a capa nunca é uma área vazia e, havendo foto do PRÓPRIO parceiro, é ela. Ordem: a capa que o parceiro
 * enviou → a 1ª foto da galeria dele (E306, 01/11) → a foto de perfil → a foto da categoria principal (só quando o
 * parceiro não tem foto nenhuma). Sem nada (categoria sem foto), null.
 */
export function capaDoParceiro(p: { nomePublico: string; bannerUrl: string | null; galeriaCapaUrl?: string | null; avatarUrl: string | null; categorias: readonly string[] }): CapaParceiro {
  if (p.bannerUrl) return { src: p.bannerUrl, alt: `Capa de ${p.nomePublico}`, origem: "capa" };
  if (p.galeriaCapaUrl) return { src: p.galeriaCapaUrl, alt: `Trabalho de ${p.nomePublico}`, origem: "galeria" };
  if (p.avatarUrl) return { src: p.avatarUrl, alt: `Foto de ${p.nomePublico}`, origem: "foto" };
  for (const c of p.categorias) {
    const f = fotoDaCategoria(c);
    if (f) return { src: f.src, alt: f.alt, origem: "categoria" };
  }
  return null;
}

/** E299: o selo que todo parceiro publicado tem (passou pela aprovação da Viva) — o mesmo texto no cartão e no detalhe. */
export const SELO_APROVADO = "Aprovado pela Viva";

/**
 * E341 (01/11): o que o editor do parceiro diz sobre a capa que VALE na página pública (a mesma `capaDoParceiro`). Sem
 * capa própria, a página usa outra foto — o editor mostra qual e como trocar, em vez de "sem capa".
 */
export function avisoCapaNoEditor(origem: NonNullable<CapaParceiro>["origem"] | null): string {
  if (origem === "capa") return "Esta é a capa da sua página.";
  if (origem === "galeria") return "Sem capa própria: sua página usa como capa a 1ª foto da sua galeria. Envie uma capa para escolher a sua.";
  if (origem === "foto") return "Sem capa própria: sua página usa como capa a sua foto de perfil. Envie uma capa para escolher a sua.";
  if (origem === "categoria") return "Sem capa própria: sua página usa uma foto ilustrativa da sua categoria. Envie uma capa ou fotos do seu trabalho.";
  return "Sem capa: envie uma foto larga para o topo da sua página.";
}
