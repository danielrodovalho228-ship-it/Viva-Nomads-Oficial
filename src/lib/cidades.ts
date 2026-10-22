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

/**
 * Título da contagem na página da cidade. Reais e exemplos nunca somam num número só:
 * "1 imóvel + 15 de exemplo" em vez de "16 imóveis".
 */
export function tituloContagemCidade(reais: number, exemplos: number, cidade: string): string {
  if (reais + exemplos === 0) return `Ainda não há imóveis em ${cidade}`;
  if (reais === 0) return `${exemplos} ${exemplos === 1 ? "anúncio" : "anúncios"} de exemplo em ${cidade}`;
  const reaisTxt = `${reais} ${reais === 1 ? "imóvel" : "imóveis"}`;
  if (exemplos === 0) return `${reaisTxt} em ${cidade}`;
  return `${reaisTxt} + ${exemplos} de exemplo em ${cidade}`;
}
