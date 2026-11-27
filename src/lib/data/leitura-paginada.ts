/**
 * E1051 — lê TODAS as linhas de uma consulta do PostgREST, em páginas. O servidor corta cada resposta em `max_rows`
 * (1000, supabase/config.toml); sem paginar, uma consulta da lista inteira perdia o fim, e o que se perdia mudava entre
 * carregamentos. A consulta tem de vir numa ORDEM TOTAL (senão as páginas se sobrepõem): quem chama põe os `.order()`.
 * Para quando a página vem menor que o tamanho pedido. Erro numa página → lança (quem chama decide o best-effort).
 */
export const PAGINA_POSTGREST = 1000;

export async function lerTodasAsLinhas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  tamanho = PAGINA_POSTGREST,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw error;
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < tamanho) return linhas;
  }
}
