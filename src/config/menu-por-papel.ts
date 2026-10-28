/**
 * Itens do menu do painel POR PAPEL (Prompt 42, item 3). Esta lista é o que se edita para mudar o menu (Pista B); o
 * componente que desenha (DashboardShell + MenuCascata) não muda (Pista A). A montagem fica em menu-painel.ts.
 *
 * Conta única (ordem 9f3085d8): todo usuário é morador (vê "Minha moradia"); proprietário = já anunciou um imóvel;
 * parceiro = tem a parceria ou um pedido dela; admin = equipe. As seções aparecem NESTA ordem, só para quem tem o
 * papel; `quando` esconde um item específico conforme o contexto (estadia ativa, imóveis ativos…).
 *
 * REGRA PERMANENTE (0.5): todo href aponta para rota interna do painel (/dashboard/*, /qualificar ou /admin*) — exceto
 * a busca pública (/buscar) e o formulário do pedido (/pedidos/novo). O teste menu-por-papel.test.ts confere.
 */

import { MIN_IMOVEIS_ANALISE_CARTEIRA } from "../lib/cobranca/regra.ts";
import { PROGRAMA_INDICACAO } from "../lib/flags.ts";

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
  /** Prompt 31a: a conta tem o papel de parceiro (ou um pedido de parceria) — revela o item "Parceiro". */
  parceiro?: boolean;
  /**
   * PAPEL-B: o papel ativo. A seção dele vem logo depois da Visão geral (o resto segue na ordem de sempre). Só muda a
   * ordem: nenhuma seção some ou aparece por causa dele.
   */
  papelAtivo?: "morador" | "proprietario" | "parceiro" | null;
  /** PROP-1: o modo em uso. No modo dono, os itens do lado morador (Minha moradia) não aparecem. */
  modo?: "owner" | "tenant";
}

export type PapelMenu = "todos" | "morador" | "proprietario" | "parceiro" | "admin";

/** Item da lista: o ItemMenu com a condição opcional de exibição. */
export interface ItemDoPapel extends Omit<ItemMenu, "filhos"> {
  filhos?: ItemDoPapel[];
  quando?: (ctx: ContextoMenu) => boolean;
}

export interface SecaoDoPapel {
  papel: PapelMenu;
  itens: ItemDoPapel[];
}

/** Quem tem cada papel, a partir do contexto da conta. */
export function temPapel(papel: PapelMenu, ctx: ContextoMenu): boolean {
  if (papel === "todos" || papel === "morador") return true;
  if (papel === "proprietario") return ctx.temImovel;
  if (papel === "parceiro") return !!ctx.parceiro;
  return ctx.admin;
}

// ADMIN-1: em /dashboard* o admin vê as áreas de usuário e UM item que leva ao painel; a barra do admin (só em /admin*)
// mora em config/menu-admin.ts.
const ADMIN: ItemDoPapel[] = [{ id: "admin", rotulo: "Painel admin", icone: "admin", href: "/admin" }];

const MORADOR: ItemDoPapel[] = [
  {
    id: "moradia",
    rotulo: "Minha moradia",
    icone: "moradia",
    filhos: [
      { id: "buscar", rotulo: "Buscar imóveis", icone: "buscar", href: "/buscar" },
      { id: "favoritos", rotulo: "Favoritos & comparações", icone: "favoritos", href: "/dashboard/favoritos" },
      { id: "buscas", rotulo: "Buscas salvas", icone: "buscas", href: "/dashboard/buscas" },
      { id: "pedidos", rotulo: "Meus pedidos", icone: "pedidos", href: "/dashboard/pedidos" },
      // Prompt 30, item 6: a porta do pedido no menu do inquilino (o formulário é a página pública /pedidos/novo).
      { id: "publicar-pedido", rotulo: "Publicar pedido de moradia", icone: "pedidos", href: "/pedidos/novo" },
      { id: "candidaturas", rotulo: "Candidaturas", icone: "candidaturas", href: "/dashboard/candidaturas" },
      // Prompt 27 (item 7): as propostas que os proprietários enviaram, com o número das que esperam a resposta.
      { id: "propostas-inquilino", rotulo: "Propostas", icone: "orcamentos", href: "/dashboard/propostas" },
      { id: "visitas", rotulo: "Visitas por vídeo", icone: "visitas", href: "/dashboard/visitas" },
      // Prompt 28: contrato aguardando assinatura ainda não é locação — "Contratos" (com o número do que falta assinar)
      // e "Locações" (as ativas e as encerradas).
      { id: "contratos-inquilino", rotulo: "Contratos", icone: "contratos", href: "/dashboard/contratos" },
      // Adendo ao prompt 28: o dono (tem imóvel) sem estadia própria não vê "Locações" — o lugar dele é
      // "Contratos & blocos"; o inquilino continua vendo.
      { id: "estadias", rotulo: "Locações", icone: "estadias", href: "/dashboard/locacoes", quando: (ctx) => !(ctx.temImovel && !ctx.estadiaAtiva) },
      { id: "solicitacoes", rotulo: "Solicitações", icone: "solicitacoes", href: "/dashboard/solicitacoes", quando: (ctx) => ctx.estadiaAtiva },
      // Ordem 521c5af7 (S1): serviços de parceiros, só para quem tem locação ativa.
      { id: "servicos", rotulo: "Serviços", icone: "ferramentas", href: "/dashboard/servicos", quando: (ctx) => ctx.estadiaAtiva },
    ],
  },
];

const COMUNICACAO: ItemDoPapel[] = [
  {
    id: "comunicacao",
    rotulo: "Mensagens",
    icone: "mensagens",
    filhos: [
      { id: "mensagens", rotulo: "Mensagens", icone: "mensagens", href: "/dashboard/mensagens" },
      { id: "notificacoes", rotulo: "Notificações", icone: "notificacoes", href: "/dashboard/notificacoes" },
    ],
  },
];

const PROPRIETARIO: ItemDoPapel[] = [
  {
    id: "imoveis",
    rotulo: "Meus imóveis",
    icone: "imoveis",
    filhos: [
      { id: "imoveis-lista", rotulo: "Anúncios", icone: "imoveis", href: "/dashboard/imoveis" },
      { id: "interessados", rotulo: "Interessados", icone: "interessados", href: "/dashboard/leads" },
      { id: "pedidos-cidade", rotulo: "Pedidos de moradia", icone: "pedidosCidade", href: "/dashboard/pedidos-cidade" },
      { id: "fechamento", rotulo: "Fechamento", icone: "fechamento", href: "/dashboard/fechamento" },
    ],
  },
  {
    id: "contratos",
    rotulo: "Contratos e garantias",
    icone: "contratos",
    filhos: [
      { id: "contratos-lista", rotulo: "Contratos & blocos", icone: "contratos", href: "/dashboard/contratos" },
      { id: "garantias", rotulo: "Caução e garantias", icone: "garantias", href: "/dashboard/garantias" },
      // PROP-1: "Conferência de entrada" saiu do menu (o PROP-5 a leva para dentro de cada contrato).
      // Prompt 39-B1: "Recibos e notas" — subitem da área de Ganhos do dono (no celular, bloco da aba Ganhos).
      { id: "recibos", rotulo: "Recibos e notas", icone: "documentos", href: "/dashboard/recibos" },
    ],
  },
];

// Prompt 31a: o papel de parceiro é a tabela parceiros (conta única); o item aparece quando ela existe.
const PARCEIRO: ItemDoPapel[] = [{ id: "parceiro", rotulo: "Parceiro", icone: "parceiros", href: "/dashboard/parceiro" }];

const FERRAMENTAS_E_CONTA: ItemDoPapel[] = [
  {
    id: "ferramentas",
    rotulo: "Ferramentas",
    icone: "ferramentas",
    filhos: [
      { id: "ferramentas-todas", rotulo: "Todas as ferramentas", icone: "ferramentas", href: "/dashboard/ferramentas" },
      { id: "agenda", rotulo: "Agenda", icone: "visitas", href: "/dashboard/agenda", quando: (ctx) => ctx.temImovel },
      { id: "simulador", rotulo: "Simulador de rentabilidade", icone: "simulador", href: "/dashboard/simulador" },
      { id: "roi", rotulo: "Calculadora de ROI", icone: "roi", href: "/dashboard/roi-imovel" },
      // Prompt 42, item 4: o simulador PF × PJ (já em /dashboard/tributacao e no hub) também no menu.
      { id: "tributacao", rotulo: "Tributação PF × PJ", icone: "dinheiro", href: "/dashboard/tributacao" },
      {
        id: "carteira",
        rotulo: "Análise da carteira",
        icone: "carteira",
        href: "/dashboard/carteira",
        quando: (ctx) => (ctx.imoveisAtivos ?? 0) >= MIN_IMOVEIS_ANALISE_CARTEIRA,
      },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "orcamentos", href: "/dashboard/orcamentos", quando: (ctx) => ctx.temImovel },
      // NAV-A: o programa de indicação saiu do menu da Conta (a Conta é só a pessoa) e mora aqui, com a mesma chave.
      { id: "indicacoes", rotulo: "Indicações", icone: "ferramentas", href: "/dashboard/indicacoes", quando: () => PROGRAMA_INDICACAO },
    ],
  },
  {
    id: "conta",
    rotulo: "Minha conta",
    icone: "conta",
    filhos: [
      { id: "conta-dados", rotulo: "Perfil", icone: "conta", href: "/dashboard/conta" },
      { id: "avaliacoes", rotulo: "Avaliações", icone: "conta", href: "/dashboard/avaliacoes" },
      { id: "verificacao", rotulo: "Verificação", icone: "verificacao", href: "/dashboard/verificacao" },
    ],
  },
];

/** O menu inteiro, na ordem em que aparece. Cada seção só entra para quem tem o papel. */
export const MENU_POR_PAPEL: SecaoDoPapel[] = [
  { papel: "todos", itens: [{ id: "visao", rotulo: "Visão geral", icone: "visao", href: "/dashboard" }] },
  { papel: "admin", itens: ADMIN },
  { papel: "morador", itens: MORADOR },
  { papel: "todos", itens: COMUNICACAO },
  { papel: "proprietario", itens: PROPRIETARIO },
  { papel: "parceiro", itens: PARCEIRO },
  { papel: "todos", itens: FERRAMENTAS_E_CONTA },
];

/** Botão de entrada para quem nunca anunciou. */
export const ANUNCIAR: ItemMenu = {
  id: "anunciar",
  rotulo: "Anunciar meu imóvel",
  icone: "anunciar",
  href: "/dashboard/imoveis/novo",
};
