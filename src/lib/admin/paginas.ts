/*
  E281 — leitura paginada para os números do admin. PURO. O servidor do banco devolve no máximo 1.000 linhas por
  consulta (supabase/config.toml, max_rows); um .limit() maior é cortado em silêncio e o número sai menor que o real.
  Roda: node --test src/lib/admin/paginas.test.ts
*/

/** Linhas por página: o teto que o servidor do banco devolve por consulta (supabase/config.toml, max_rows). */
export const LINHAS_POR_PAGINA = 1000;
/** Teto de segurança da leitura paginada (200 páginas = 200 mil linhas). */
const PAGINAS_MAX = 200;

/**
 * E281 — lê TODAS as linhas de uma consulta, página a página (o banco corta cada resposta em 1.000 linhas). A
 * consulta precisa de ordem estável (ex.: por id). Para quando uma página volta incompleta, ou num erro.
 */
export async function todasAsPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  porPagina = LINHAS_POR_PAGINA,
): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < PAGINAS_MAX; i++) {
    const { data, error } = await pagina(i * porPagina, (i + 1) * porPagina - 1);
    if (error || !data) break;
    todas.push(...(data as T[]));
    if (data.length < porPagina) break;
  }
  return todas;
}

