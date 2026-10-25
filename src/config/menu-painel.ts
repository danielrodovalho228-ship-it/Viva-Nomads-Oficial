/**
 * Menu do painel em CASCATA (ordem 9f3085d8 — decisão do Daniel de 14/10, conta única).
 *
 *  • Uma conta só, sem seletor de modo: todo usuário vê "Minha moradia" (busca,
 *    favoritos, candidaturas, Minhas estadias).
 *  • As seções de dono ("Meus imóveis", "Contratos e garantias") entram no MESMO menu,
 *    só para quem já anunciou um imóvel; quem nunca anunciou vê "Anunciar meu imóvel".
 *  • "Ferramentas" é a parte central do negócio: grupo próprio, aberto a todos (o
 *    simulador também convence quem ainda não anunciou).
 *  • Admin continua separado: grupo "Administração" só para a equipe.
 *
 * REGRA PERMANENTE (0.5) segue valendo: todo href aponta para rota interna do painel
 * (/dashboard/*, /qualificar ou /admin*) — exceto "Buscar imóveis", que é a busca pública.
 * Prompt 42, item 3: os ITENS moram em config/menu-por-papel.ts (lista por papel, editável sem mexer no componente);
 * aqui fica só a montagem. Função PURA (testada em menu-painel.test.ts); quem desenha é o DashboardShell.
 */

import { MENU_POR_PAPEL, temPapel, type ContextoMenu, type ItemDoPapel, type ItemMenu } from "./menu-por-papel.ts";

export { ANUNCIAR, MENU_POR_PAPEL } from "./menu-por-papel.ts";
export type { ContextoMenu, IconeMenu, ItemMenu, PapelMenu } from "./menu-por-papel.ts";

/** Item da lista → item do menu: aplica o `quando` (em todos os níveis) e tira a condição. */
function montar(itens: ItemDoPapel[], ctx: ContextoMenu): ItemMenu[] {
  const out: ItemMenu[] = [];
  for (const { quando, filhos, ...item } of itens) {
    if (quando && !quando(ctx)) continue;
    out.push(filhos ? { ...item, filhos: montar(filhos, ctx) } : item);
  }
  return out;
}

/**
 * O menu desta conta: as seções de MENU_POR_PAPEL (config/menu-por-papel.ts) dos papéis que ela tem. PAPEL-B: com o
 * papel ativo, a seção dele sobe para logo depois da Visão geral (a 1ª seção); o resto mantém a ordem.
 */
export function menuDoPainel(ctx: ContextoMenu): ItemMenu[] {
  // PROP-1, item 4: Buscar, Buscas salvas, Favoritos, Meus pedidos, Locações e Candidaturas só no modo morador.
  const secoes = MENU_POR_PAPEL.filter((s) => temPapel(s.papel, ctx) && !(s.papel === "morador" && ctx.modo === "owner"));
  const ativo = ctx.papelAtivo;
  const ordem = ativo && secoes.some((s) => s.papel === ativo) ? [secoes[0], ...secoes.filter((s) => s.papel === ativo), ...secoes.slice(1).filter((s) => s.papel !== ativo)] : secoes;
  return ordem.flatMap((s) => montar(s.itens, ctx));
}

/** Todas as folhas (links), em ordem. */
export function folhas(itens: ItemMenu[]): ItemMenu[] {
  return itens.flatMap((i) => (i.filhos ? folhas(i.filhos) : i.href ? [i] : []));
}

/** O item (ou algum descendente) aponta para esta rota? Para abrir o grupo certo. */
export function contemRota(item: ItemMenu, pathname: string): boolean {
  if (item.href) return rotaAtiva(item.href, pathname);
  return (item.filhos ?? []).some((f) => contemRota(f, pathname));
}

/** Rota exata, ou subpágina (ex.: /dashboard/imoveis/123) — "/dashboard" só exato. */
export function rotaAtiva(href: string, pathname: string): boolean {
  const base = href.split("#")[0];
  if (base === "/dashboard" || base === "/admin") return pathname === base;
  return pathname === base || pathname.startsWith(base + "/");
}

/**
 * Para onde vai quem abre uma rota do OUTRO papel e não tem esse papel (o guarda do painel no navegador).
 * "Locações" de quem só é proprietário vira "Contratos & blocos" — a mesma regra da página no servidor (adendo ao
 * prompt 28). No celular o guarda corria antes do redirecionamento do servidor e levava o dono à Visão geral.
 */
export function destinoForaDoPapel(pathname: string): string {
  return pathname === "/dashboard/locacoes" ? "/dashboard/contratos" : "/dashboard";
}
