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
 * Função PURA (testada em menu-painel.test.ts); quem desenha é o DashboardShell.
 */

import { MIN_IMOVEIS_ANALISE_CARTEIRA } from "../lib/cobranca/regra.ts";

export type IconeMenu =
  | "visao" | "moradia" | "buscar" | "favoritos" | "buscas" | "pedidos" | "candidaturas"
  | "visitas" | "estadias" | "solicitacoes" | "mensagens" | "notificacoes" | "imoveis" | "interessados"
  | "pedidosCidade" | "fechamento" | "contratos" | "garantias" | "conferencia" | "ferramentas"
  | "simulador" | "roi" | "carteira" | "orcamentos" | "conta" | "verificacao" | "assinatura"
  | "admin" | "documentos" | "atendimento" | "parceiros" | "fotografos" | "financeiro"
  | "socios" | "marketing" | "agentes" | "operacao" | "rede" | "dinheiro" | "anunciar";

export interface ItemMenu {
  /** Chave estável (testes, estado aberto/fechado, badges). */
  id: string;
  rotulo: string;
  icone: IconeMenu;
  /** Folha: link. Grupo: sem href, com filhos. */
  href?: string;
  filhos?: ItemMenu[];
}

export interface ContextoMenu {
  /** A conta já anunciou ao menos um imóvel (qualquer status). */
  temImovel: boolean;
  admin: boolean;
  /** Há estadia ativa — revela "Solicitações". */
  estadiaAtiva: boolean;
  plano?: string;
  /** Imóveis ATIVOS do dono: com 3 ou mais (regra das faixas), aparece a "Análise da carteira". */
  imoveisAtivos?: number;
}

export function menuDoPainel(ctx: ContextoMenu): ItemMenu[] {
  const menu: ItemMenu[] = [{ id: "visao", rotulo: "Visão geral", icone: "visao", href: "/dashboard" }];

  if (ctx.admin) {
    menu.push({
      id: "admin",
      rotulo: "Administração",
      icone: "admin",
      filhos: [
        { id: "admin-painel", rotulo: "Painel da equipe", icone: "admin", href: "/admin" },
        {
          id: "admin-operacao",
          rotulo: "Operação",
          icone: "operacao",
          filhos: [
            { id: "admin-pedidos", rotulo: "Moderar pedidos", icone: "pedidos", href: "/admin/pedidos" },
            { id: "admin-ajuda-publicacao", rotulo: "Publicamos para você", icone: "documentos", href: "/admin/ajuda-publicacao" },
            { id: "admin-documentos", rotulo: "Documentos", icone: "documentos", href: "/admin/documentos" },
            { id: "admin-atendimento", rotulo: "Atendimento", icone: "atendimento", href: "/admin/atendimento" },
            { id: "admin-emails-teste", rotulo: "E-mails de teste", icone: "atendimento", href: "/admin/emails-teste" },
          ],
        },
        {
          id: "admin-rede",
          rotulo: "Rede",
          icone: "rede",
          filhos: [
            { id: "admin-parceiros", rotulo: "Parceiros", icone: "parceiros", href: "/admin/parceiros" },
            { id: "admin-fotografos", rotulo: "Fotógrafos", icone: "fotografos", href: "/admin/fotografos" },
          ],
        },
        {
          id: "admin-dinheiro",
          rotulo: "Dinheiro",
          icone: "dinheiro",
          filhos: [
            { id: "admin-financeiro", rotulo: "Financeiro", icone: "financeiro", href: "/admin/financeiro" },
            { id: "admin-socios", rotulo: "Caixa dos Sócios", icone: "socios", href: "/admin/socios" },
          ],
        },
        { id: "admin-marketing", rotulo: "Marketing", icone: "marketing", href: "/admin/marketing" },
        { id: "admin-agentes", rotulo: "Agentes", icone: "agentes", href: "/admin/agentes" },
      ],
    });
  }

  const moradia: ItemMenu[] = [
    { id: "buscar", rotulo: "Buscar imóveis", icone: "buscar", href: "/buscar" },
    { id: "favoritos", rotulo: "Favoritos & comparações", icone: "favoritos", href: "/dashboard/favoritos" },
    { id: "buscas", rotulo: "Buscas salvas", icone: "buscas", href: "/dashboard/buscas" },
    { id: "pedidos", rotulo: "Meus pedidos", icone: "pedidos", href: "/dashboard/pedidos" },
    { id: "candidaturas", rotulo: "Candidaturas", icone: "candidaturas", href: "/dashboard/candidaturas" },
    { id: "visitas", rotulo: "Visitas por vídeo", icone: "visitas", href: "/dashboard/visitas" },
    { id: "estadias", rotulo: "Minhas estadias", icone: "estadias", href: "/dashboard/locacoes" },
  ];
  if (ctx.estadiaAtiva)
    moradia.push({ id: "solicitacoes", rotulo: "Solicitações", icone: "solicitacoes", href: "/dashboard/solicitacoes" });
  menu.push({ id: "moradia", rotulo: "Minha moradia", icone: "moradia", filhos: moradia });

  menu.push({
    id: "comunicacao",
    rotulo: "Mensagens",
    icone: "mensagens",
    filhos: [
      { id: "mensagens", rotulo: "Conversas", icone: "mensagens", href: "/dashboard/mensagens" },
      { id: "notificacoes", rotulo: "Notificações", icone: "notificacoes", href: "/dashboard/notificacoes" },
    ],
  });

  if (ctx.temImovel) {
    menu.push({
      id: "imoveis",
      rotulo: "Meus imóveis",
      icone: "imoveis",
      filhos: [
        { id: "imoveis-lista", rotulo: "Anúncios", icone: "imoveis", href: "/dashboard/imoveis" },
        { id: "interessados", rotulo: "Interessados", icone: "interessados", href: "/dashboard/leads" },
        { id: "pedidos-cidade", rotulo: "Pedidos de moradia", icone: "pedidosCidade", href: "/dashboard/pedidos-cidade" },
        { id: "fechamento", rotulo: "Fechamento", icone: "fechamento", href: "/dashboard/fechamento" },
      ],
    });
    menu.push({
      id: "contratos",
      rotulo: "Contratos e garantias",
      icone: "contratos",
      filhos: [
        { id: "contratos-lista", rotulo: "Contratos & blocos", icone: "contratos", href: "/dashboard/contratos" },
        { id: "garantias", rotulo: "Caução e garantias", icone: "garantias", href: "/dashboard/garantias" },
        { id: "conferencia", rotulo: "Conferência de entrada", icone: "conferencia", href: "/dashboard/contratos#conferencia" },
      ],
    });
  }

  menu.push({
    id: "ferramentas",
    rotulo: "Ferramentas",
    icone: "ferramentas",
    filhos: [
      { id: "ferramentas-todas", rotulo: "Todas as ferramentas", icone: "ferramentas", href: "/dashboard/ferramentas" },
      ...(ctx.temImovel ? [{ id: "agenda", rotulo: "Agenda", icone: "visitas" as const, href: "/dashboard/agenda" }] : []),
      { id: "simulador", rotulo: "Simulador de rentabilidade", icone: "simulador", href: "/dashboard/simulador" },
      { id: "roi", rotulo: "Calculadora de ROI", icone: "roi", href: "/dashboard/roi-imovel" },
      ...((ctx.imoveisAtivos ?? 0) >= MIN_IMOVEIS_ANALISE_CARTEIRA
        ? [{ id: "carteira", rotulo: "Análise da carteira", icone: "carteira" as const, href: "/dashboard/carteira" }]
        : []),
      ...(ctx.temImovel
        ? [{ id: "orcamentos", rotulo: "Orçamentos", icone: "orcamentos" as const, href: "/dashboard/orcamentos" }]
        : []),
    ],
  });

  menu.push({
    id: "conta",
    rotulo: "Minha conta",
    icone: "conta",
    filhos: [
      { id: "conta-dados", rotulo: "Perfil e dados", icone: "conta", href: "/dashboard/conta" },
      { id: "avaliacoes", rotulo: "Avaliações recebidas", icone: "conta", href: "/dashboard/avaliacoes" },
      { id: "verificacao", rotulo: "Verificação", icone: "verificacao", href: "/dashboard/conta#confianca" },
    ],
  });

  return menu;
}

/** Botão de entrada para quem nunca anunciou. */
export const ANUNCIAR: ItemMenu = {
  id: "anunciar",
  rotulo: "Anunciar meu imóvel",
  icone: "anunciar",
  href: "/dashboard/imoveis/novo",
};

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
