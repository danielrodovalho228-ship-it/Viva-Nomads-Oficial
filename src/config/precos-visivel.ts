/**
 * E563 (decisão do Daniel, 04/11/2026): a página de preços está SUSPENSA — não cancelada. Esta chave governa TODAS as
 * portas para /precos (menu "Planos", "Preços" do rodapé, cartão "Planos e taxas" da home, destaque de /anunciar e os
 * links secundários) e a própria rota. O código do E555 fica intacto.
 *
 * Religar a página: NEXT_PUBLIC_PRECOS_VISIVEL=1 no ambiente (a mesma variável que o next.config lê para /planos).
 * Sem a variável, fica DESLIGADA.
 */
export function chavePrecos(valor: string | undefined): boolean {
  return valor === "1";
}

export const PRECOS_VISIVEL: boolean = chavePrecos(process.env.NEXT_PUBLIC_PRECOS_VISIVEL);

/** Link que leva à página de preços (/precos, /planos e as âncoras dela). */
export function ehPortaDePrecos(href: string): boolean {
  return /^\/(precos|planos)(?:[#?/]|$)/.test(href);
}

/** Com a chave desligada, tira da lista os links que levam à página de preços; ligada, devolve a lista como está. */
export function comPortasDePrecos<T extends { href: string }>(itens: T[], visivel: boolean = PRECOS_VISIVEL): T[] {
  return visivel ? itens : itens.filter((i) => !ehPortaDePrecos(i.href));
}
