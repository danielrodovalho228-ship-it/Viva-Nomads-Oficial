/*
  E1047: a sincronização da URL da /buscar só chama o history.replaceState quando a URL muda de fato.
  Nesta versão do Next, cada replaceState vira uma ação "restore" do router, e essa ação descarta uma navegação de <Link>
  que esteja pendente: o toque num card logo depois da busca aparecer perdia-se. Com a URL igual não há nada a refletir.
  Teste: src/lib/navegacao/e1047-url-da-busca.test.ts
*/
type Janela = {
  location: { pathname: string; search: string };
  history: { replaceState: (data: unknown, unused: string, url: string) => void };
};

/** Reflete a busca na URL sem recarregar nem rolar. Devolve se chamou o replaceState. */
export function sincronizarUrlDaBusca(nova: string, alvo: Janela = window): boolean {
  if (nova === `${alvo.location.pathname}${alvo.location.search}`) return false;
  alvo.history.replaceState(null, "", nova);
  return true;
}
