/*
  Cidade sem duplicata por grafia ("Uberlândia" × "Uberlandia"). Módulo puro:
  a lista do IBGE entra por parâmetro (src/lib/municipios.ts a carrega).
*/

/** Chave de comparação: sem acento, minúscula, espaços únicos. */
export function chaveCidade(t: string | null | undefined): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome OFICIAL (com acento) da cidade na lista da UF, ou null se não existe. */
export function acharCidade(lista: readonly string[] | undefined, nome: string): string | null {
  const k = chaveCidade(nome);
  if (!k || !lista) return null;
  return lista.find((c) => chaveCidade(c) === k) ?? null;
}

/** Mesma cidade, qualquer grafia/acentuação. */
export function mesmaCidade(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = chaveCidade(a);
  return !!ka && ka === chaveCidade(b);
}
