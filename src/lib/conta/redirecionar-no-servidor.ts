/**
 * E798 (prova ao vivo do piloto do E793, 12/11): rotas da Conta que só levam a outra tela redirecionam NO SERVIDOR (proxy),
 * antes de desenhar — antes, a casca abria com a área principal em branco e o redirecionamento acontecia no navegador.
 * Puro (sem next/server): o proxy e a página antiga usam as mesmas funções.
 */

/** Cookie com a largura da tela do aparelho ("larga" ≥ 1024 px, o limite do E492), gravado pela casca do painel. */
export const COOKIE_TELA = "vn-tela";
export type Tela = "larga" | "estreita";
export const LARGURA_COMPUTADOR = 1024;

export function telaDaLargura(largura: number): Tela {
  return largura >= LARGURA_COMPUTADOR ? "larga" : "estreita";
}

/** E679 (E85): /dashboard/conta/avaliacoes virou /dashboard/avaliacoes (aba Recebidas), com o filtro e a busca. */
export function destinoContaAvaliacoes(sp: URLSearchParams): string {
  const aba = sp.get("aba");
  const filtro = aba === "recentes" || aba === "positivas" ? `&filtro=${aba}` : "";
  const q = sp.get("q");
  const busca = q ? `&q=${encodeURIComponent(q.slice(0, 80))}` : "";
  return `/dashboard/avaliacoes?aba=recebidas${filtro}${busca}`;
}

/**
 * Para onde o proxy manda esta rota da Conta (ou null: segue para a página).
 * - /dashboard/conta/avaliacoes: sempre para Avaliações.
 * - /dashboard/conta: no computador (cookie "larga"), para o Perfil (E492). No celular, ou sem o cookie (1ª visita), a
 *   página decide como antes (menu da Conta; no computador, o efeito do cliente ainda leva ao Perfil).
 *   As âncoras antigas (#documento…) não chegam ao servidor: o navegador as mantém no redirecionamento e o Perfil as
 *   encaminha (AncoraAntigaDaConta).
 */
export function redirecionamentoDaConta(pathname: string, sp: URLSearchParams, tela: string | undefined): string | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/dashboard/conta/avaliacoes") return destinoContaAvaliacoes(sp);
  if (p === "/dashboard/conta" && tela === "larga") return "/dashboard/conta/perfil";
  return null;
}
