/** Janela mínima que precisamos (facilita testar sem navegador). */
export type JanelaAba = { opener: unknown; location: { href: string }; close: () => void };

/**
 * Abre o link numa aba nova SEM ser barrado pelo bloqueador de pop-up: a aba nasce
 * no clique (síncrono) e só depois, quando o servidor devolve o link, segue para ele.
 * Abrir a aba depois de um `await` é bloqueado no Safari/iPhone.
 */
export async function abrirLinkEmNovaAba(
  abrir: () => JanelaAba | null,
  buscarUrl: () => Promise<string | null>,
): Promise<boolean> {
  const aba = abrir();
  const url = await buscarUrl().catch(() => null);
  if (!url) {
    aba?.close();
    return false;
  }
  if (!aba) return false;
  aba.opener = null;
  aba.location.href = url;
  return true;
}
