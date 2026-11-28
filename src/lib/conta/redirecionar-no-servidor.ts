/**
 * E798 (prova ao vivo do piloto do E793, 12/11): rotas da Conta que só levam a outra tela redirecionam NO SERVIDOR (proxy),
 * antes de desenhar — antes, a casca abria com a área principal em branco e o redirecionamento acontecia no navegador.
 * Puro (sem next/server): o proxy e a página antiga usam as mesmas funções.
 */

import { ALIAS_SECAO, SECOES_CONTA } from "./secoes.ts";

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

/**
 * E979: o cookie da largura fica desatualizado quando a largura muda FORA do painel (só o painel o regrava). Com
 * "larga" guardado e a tela hoje estreita, o proxy mandava /dashboard/conta para o Perfil e a pessoa não via o menu da
 * Conta. O proxy marca esse redirecionamento (cookie curto, só na Conta); o Perfil lê a marca e, em tela estreita, volta
 * ao menu (VoltarAoMenuSeTelaEstreita).
 */
export const COOKIE_VEIO_DA_CONTA = "vn-conta-proxy";

/** Só o redirecionamento /dashboard/conta → Perfil leva a marca (o de /avaliacoes não depende da largura). */
export function marcaDoRedirecionamentoDaConta(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/dashboard/conta";
}

/**
 * No Perfil: volta ao menu da Conta? Só quando a página veio do redirecionamento do proxy E a tela é estreita. Quem abriu
 * o Perfil pelo menu (sem a marca) fica no Perfil; no computador o redirecionamento estava certo; e a âncora antiga
 * (/dashboard/conta#documento) segue o encaminhamento dela (E798).
 */
export function voltarAoMenuDaConta(c: { veioDoProxy: boolean; largura: number; destinoDaAncora: string | null }): boolean {
  return c.veioDoProxy && !c.destinoDaAncora && telaDaLargura(c.largura) === "estreita";
}

/** Subtelas da Conta que têm endereço próprio e não são seção nem endereço antigo (ALIAS_SECAO). */
const SUBTELAS_DA_CONTA: readonly string[] = ["perfil-publico"];

/**
 * E1003: /dashboard/conta/<parte> em que <parte> não é seção (SECOES_CONTA), endereço antigo (ALIAS_SECAO) nem subtela.
 * O proxy responde o 404 do resto do site ANTES de a página desenhar; a página só descobria depois de a resposta ter
 * começado, e o endereço respondia 200 com a tela "não encontrada". Qualquer outro caminho (o menu da Conta, mais de uma
 * parte, fora da Conta) não é com esta regra: devolve false e segue o caminho de sempre.
 * Guarda: e1003-secao-inexistente.test.ts cobra que toda pasta e todo "case" da página da Conta estão cobertos aqui.
 */
export function secaoDaContaInexistente(pathname: string): boolean {
  const m = pathname.replace(/\/+$/, "").match(/^\/dashboard\/conta\/([^/]+)$/);
  if (!m) return false;
  const parte = m[1];
  return !(SECOES_CONTA.some((s) => s.id === parte) || Object.hasOwn(ALIAS_SECAO, parte) || SUBTELAS_DA_CONTA.includes(parte));
}
