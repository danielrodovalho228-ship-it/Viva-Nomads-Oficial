/*
  E1170 (ORDENS-DUET 740, 745 e 759) — a leitura por páginas das listas da Central que separam as contas de teste.
  As listas liam as 50 linhas mais recentes e só depois separavam as de conta de teste: com 50 ou mais linhas de teste
  recentes, as reais mais antigas nem chegavam a ser lidas. Aqui a leitura segue, página a página, até a lista de
  trabalho (as reais) encher ou os dados acabarem. As de teste têm o seu próprio limite.
  O teto de páginas existe para a página nunca ler sem fim; se for atingido, a tela diz que a lista pode estar
  incompleta (texto aprovado na ORDEM-DUET-759). PURO (node --test), sem imports @/.
*/
export const LINHAS_POR_PAGINA = 50;
export const TETO_DE_PAGINAS = 20;
export const AVISO_LISTA_INCOMPLETA = "A lista pode estar incompleta: há mais registros do que a página lê.";

export interface LeituraPorPaginas<T> {
  /** As linhas, na ordem do banco: no máximo 50 reais e no máximo 50 de conta de teste. `null` se a leitura falhou. */
  data: T[] | null;
  /** A falha da página que não se leu. Com ela, `data` é `null`: nunca uma lista curta que parece certa. */
  error: { message: string } | null;
  /** O teto de páginas foi atingido sem a lista de trabalho encher e sem os dados acabarem. */
  incompleta: boolean;
}

/**
 * Lê por páginas até a lista de trabalho encher.
 * `lerPagina(de, ate)`: a consulta já filtrada e ordenada, com a fatia pedida (`.range(de, ate)`).
 * `conta`: de quem é a linha (o dono do pedido). Linha sem conta conhecida conta como real.
 */
export async function lerSeparandoContasDeTeste<T>(
  lerPagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  conta: (linha: T) => string | null | undefined,
  contasDeTeste: ReadonlySet<string>,
): Promise<LeituraPorPaginas<T>> {
  const data: T[] = [];
  let reais = 0;
  let deTeste = 0;
  for (let pagina = 0; pagina < TETO_DE_PAGINAS; pagina++) {
    const de = pagina * LINHAS_POR_PAGINA;
    const lida = await lerPagina(de, de + LINHAS_POR_PAGINA - 1);
    if (lida.error) return { data: null, error: lida.error, incompleta: false };
    const linhas = (lida.data ?? []) as T[];
    for (const l of linhas) {
      const c = conta(l);
      if (c && contasDeTeste.has(c)) {
        if (deTeste < LINHAS_POR_PAGINA) data.push(l);
        deTeste++;
      } else {
        if (reais < LINHAS_POR_PAGINA) data.push(l);
        reais++;
      }
    }
    // Acabaram os dados, ou a lista de trabalho já está cheia: não há mais nada a procurar.
    if (linhas.length < LINHAS_POR_PAGINA || reais >= LINHAS_POR_PAGINA) return { data, error: null, incompleta: false };
  }
  return { data, error: null, incompleta: true };
}
