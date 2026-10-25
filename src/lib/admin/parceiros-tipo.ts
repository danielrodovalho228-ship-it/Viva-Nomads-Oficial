/*
  ADMIN-2 — Parceiros e Fotógrafos numa tela só (/admin/parceiros), com as abas de tipo "Todos | Fotógrafos | Outros".
  /admin/fotografos redireciona para ?tipo=fotografo. Um contador só, da mesma consulta: Todos = Fotógrafos + Outros.
  PURO.
*/
export const TIPOS_PARCEIRO = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "fotografo", rotulo: "Fotógrafos" },
  { valor: "outros", rotulo: "Outros" },
] as const;
export type TipoParceiro = (typeof TIPOS_PARCEIRO)[number]["valor"];

export const HREF_FOTOGRAFOS = "/admin/parceiros?tipo=fotografo";

export function tipoDoParam(v: unknown): TipoParceiro {
  return TIPOS_PARCEIRO.some((t) => t.valor === v) ? (v as TipoParceiro) : "todos";
}

/** Fotógrafo = parceiro (ou pedido) com a categoria fotografia. */
export const ehFotografo = (categorias: readonly string[] | null | undefined) => (categorias ?? []).includes("fotografia");

export function doTipo(tipo: TipoParceiro, categorias: readonly string[] | null | undefined): boolean {
  if (tipo === "todos") return true;
  return tipo === "fotografo" ? ehFotografo(categorias) : !ehFotografo(categorias);
}

/** A contagem de cada aba sai da MESMA lista; Todos é a soma das outras duas. */
export function contarPorTipo(linhas: readonly { categorias?: readonly string[] | null }[]): Record<TipoParceiro, number> {
  const fotografo = linhas.filter((l) => ehFotografo(l.categorias)).length;
  const outros = linhas.length - fotografo;
  return { todos: fotografo + outros, fotografo, outros };
}

/** Link de Parceiros mantendo a situação (aba) e o tipo; "todos" e "pendentes" ficam fora da URL. */
export function hrefParceiros(p: { aba?: string; tipo?: TipoParceiro }): string {
  const q = new URLSearchParams();
  if (p.aba && p.aba !== "pendentes") q.set("aba", p.aba);
  if (p.tipo && p.tipo !== "todos") q.set("tipo", p.tipo);
  const s = q.toString();
  return s ? `/admin/parceiros?${s}` : "/admin/parceiros";
}
