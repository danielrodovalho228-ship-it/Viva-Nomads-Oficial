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
 * - /dashboard/conta: no computador (cookie "larga"), para o Perfil (E492), com a consulta junto. No celular, ou sem o
 *   cookie (1ª visita), a página decide como antes (menu da Conta; no computador, o efeito do cliente ainda leva ao Perfil).
 *   As âncoras antigas (#documento…) não chegam ao servidor: o navegador as mantém no redirecionamento e o Perfil as
 *   encaminha (AncoraAntigaDaConta).
 */
export function redirecionamentoDaConta(pathname: string, sp: URLSearchParams, tela: string | undefined): string | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/dashboard/conta/avaliacoes") return destinoContaAvaliacoes(sp);
  if (p === "/dashboard/conta" && tela === "larga") {
    // A consulta vai junto: o link antigo /dashboard/conta?linkedin=conectado#confianca chega ao Perfil com ela, e a
    // âncora leva a Segurança com o retorno do LinkedIn (a âncora não chega ao servidor; a consulta chega).
    const consulta = sp.toString();
    return `/dashboard/conta/perfil${consulta ? `?${consulta}` : ""}`;
  }
  return null;
}

/**
 * O proxy decide /dashboard/conta pelo cookie da largura, que pode estar desatualizado (janela estreitada ou tablet
 * girado com o painel fechado). Ao mandar /dashboard/conta para o Perfil, ele grava esta marca de vida curta; o Perfil
 * a lê e, se a tela for estreita, corrige o cookie da largura e volta ao menu da Conta (E492: no celular,
 * /dashboard/conta é o menu).
 */
export const COOKIE_VEIO_DA_CONTA = "vn-veio-da-conta";
export const VIDA_VEIO_DA_CONTA_S = 15;

/** Só o redirecionamento de /dashboard/conta leva a marca (o de /dashboard/conta/avaliacoes não depende da largura). */
export function marcaVindaDaConta(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/dashboard/conta";
}

/** No Perfil: para onde voltar quando a pessoa veio do redirecionamento de /dashboard/conta numa tela estreita (ou null). */
export function voltaAoMenuDaConta(o: { veioDeConta: boolean; telaLarga: boolean; search: string }): string | null {
  if (!o.veioDeConta || o.telaLarga) return null;
  return `/dashboard/conta${o.search && o.search !== "?" ? o.search : ""}`;
}
