/**
 * MENUS-5 (25/10) — FONTE ÚNICA das abas do painel por papel: as abas do topo no computador e a barra de baixo do
 * celular saem DESTA lista (rótulos e hrefs idênticos nos dois). No máximo 5 destinos por papel; o resto vira subaba,
 * sino ou Conta (avatar). PURA (testada em abas-painel.test.ts); quem desenha é o TopoPainel (computador) e a
 * MobileTabBar (celular). O admin fora (trilha ADMIN: config/menu-admin.ts).
 *
 *  • Morador (MORADOR-NAV): Início · Buscar · Pedidos · Mensagens · Estadia (só com contrato). Sem contrato, 4.
 *  • Proprietário (PROP-1): Início · Anúncios · Interessados · Contratos · Mensagens — igual no celular.
 *  • Parceiro: Início · Pedidos · Agenda · Ganhos · Mensagens (as seções do painel do parceiro, até o PARCEIRO-A).
 */
import { rotaAtiva } from "./menu-painel.ts";

export type IconeAba = "inicio" | "buscar" | "pedidos" | "mensagens" | "estadia" | "anuncios" | "interessados" | "contratos" | "agenda" | "ganhos";

export interface ItemAba {
  id: string;
  rotulo: string;
  href: string;
  /** Outras rotas que também acendem este item. */
  ativoEm?: readonly string[];
}

export interface AbaPainel extends ItemAba {
  icone: IconeAba;
  subabas?: readonly ItemAba[];
  /** Exige login (no celular, sem sessão, leva ao /auth). */
  authRequired?: boolean;
  /** Sem sessão, a aba leva aqui em vez do login (o Início do visitante é a home). */
  hrefSemLogin?: string;
  badge?: "mensagens" | "interessados";
  /** Nome acessível mais completo que o rótulo. */
  descricao?: string;
}

export type PapelAbas = "morador" | "proprietario" | "parceiro";

export interface ContextoAbas {
  /** O morador tem contrato (estadia ativa ou contrato a assinar): aparece "Minha estadia". */
  comContrato: boolean;
}

const INICIO: AbaPainel = { id: "inicio", rotulo: "Início", href: "/dashboard", icone: "inicio", authRequired: true, hrefSemLogin: "/" };
const MENSAGENS: AbaPainel = { id: "mensagens", rotulo: "Mensagens", href: "/dashboard/mensagens", icone: "mensagens", authRequired: true, badge: "mensagens" };

/**
 * MENUS-5, item 4: "Minha estadia" não coube na barra de baixo a 390/360 px (laboratório menus-a: o rótulo cortava),
 * então os DOIS lugares (topo e barra) usam "Estadia" — fonte única. A tela continua com o título "Minha estadia".
 */
export const ROTULO_ESTADIA = "Estadia";

export const ABAS_MORADOR: readonly AbaPainel[] = [
  INICIO,
  {
    id: "buscar",
    rotulo: "Buscar",
    href: "/buscar",
    icone: "buscar",
    subabas: [
      { id: "buscar", rotulo: "Buscar", href: "/buscar" },
      { id: "favoritos", rotulo: "Favoritos", href: "/dashboard/favoritos", ativoEm: ["/dashboard/comparar", "/favoritos"] },
      { id: "buscas", rotulo: "Buscas salvas", href: "/dashboard/buscas" },
    ],
  },
  {
    id: "pedidos",
    rotulo: "Pedidos",
    href: "/dashboard/pedidos",
    icone: "pedidos",
    authRequired: true,
    subabas: [
      { id: "pedidos", rotulo: "Pedidos de moradia", href: "/dashboard/pedidos" },
      { id: "candidaturas", rotulo: "Candidaturas", href: "/dashboard/candidaturas" },
      { id: "propostas", rotulo: "Propostas", href: "/dashboard/propostas" },
      { id: "visitas", rotulo: "Visitas", href: "/dashboard/visitas" },
    ],
  },
  MENSAGENS,
  {
    id: "estadia",
    rotulo: ROTULO_ESTADIA,
    href: "/dashboard/locacoes",
    icone: "estadia",
    authRequired: true,
    ativoEm: ["/dashboard/estadia"],
    subabas: [
      { id: "estadia", rotulo: "Minha estadia", href: "/dashboard/locacoes", ativoEm: ["/dashboard/estadia"] },
      { id: "contrato", rotulo: "Contrato", href: "/dashboard/contratos" },
      { id: "solicitacoes", rotulo: "Solicitações", href: "/dashboard/solicitacoes" },
      { id: "servicos", rotulo: "Serviços", href: "/dashboard/servicos" },
    ],
  },
];

/** /dashboard/ganhos nasce no PROP-4; até lá a subaba "Ganhos" de Contratos não aparece. */
export const GANHOS_DISPONIVEL = false;

export const ABAS_PROPRIETARIO: readonly AbaPainel[] = [
  INICIO,
  { id: "anuncios", rotulo: "Anúncios", href: "/dashboard/imoveis", icone: "anuncios", authRequired: true },
  {
    id: "interessados",
    rotulo: "Interessados",
    href: "/dashboard/leads",
    icone: "interessados",
    authRequired: true,
    subabas: [
      { id: "interessados", rotulo: "Interessados", href: "/dashboard/leads" },
      // As propostas que o dono envia moram em /dashboard/orcamentos; /dashboard/propostas é a lista do lado morador
      // (as que ele recebeu). As duas acendem a mesma subaba "Propostas".
      { id: "propostas", rotulo: "Propostas", href: "/dashboard/orcamentos", ativoEm: ["/dashboard/propostas"] },
      { id: "fechamento", rotulo: "Fechamento", href: "/dashboard/fechamento" },
      { id: "pedidos-cidade", rotulo: "Pedidos na cidade", href: "/dashboard/pedidos-cidade" },
    ],
  },
  {
    id: "contratos",
    rotulo: "Contratos",
    href: "/dashboard/contratos",
    icone: "contratos",
    authRequired: true,
    subabas: [
      { id: "contratos", rotulo: "Contratos", href: "/dashboard/contratos" },
      ...(GANHOS_DISPONIVEL ? [{ id: "ganhos", rotulo: "Ganhos", href: "/dashboard/ganhos" }] : []),
      { id: "caucao", rotulo: "Caução", href: "/dashboard/garantias" },
      { id: "recibos", rotulo: "Recibos e notas", href: "/dashboard/recibos" },
    ],
  },
  MENSAGENS,
];

/** Parceiro aprovado: as abas do meio são as seções do painel do parceiro (âncoras em /dashboard/parceiro). */
export const ABAS_PARCEIRO: readonly AbaPainel[] = [
  INICIO,
  { id: "pedidos", rotulo: "Pedidos", href: "/dashboard/parceiro#pedidos", icone: "pedidos", authRequired: true, ativoEm: ["/dashboard/servicos/pedidos"] },
  { id: "agenda", rotulo: "Agenda", href: "/dashboard/parceiro#agenda", icone: "agenda", authRequired: true },
  { id: "ganhos", rotulo: "Ganhos", href: "/dashboard/parceiro#ganhos", icone: "ganhos", authRequired: true },
  MENSAGENS,
];

const BASE: Record<PapelAbas, readonly AbaPainel[]> = { morador: ABAS_MORADOR, proprietario: ABAS_PROPRIETARIO, parceiro: ABAS_PARCEIRO };

/** As abas do papel neste contexto (no máximo 5). Sem papel (admin nas telas /admin): nenhuma. */
export function abasDoPapelPainel(papel: PapelAbas | null, ctx: ContextoAbas = { comContrato: false }): readonly AbaPainel[] {
  if (!papel) return [];
  return BASE[papel].filter((a) => a.id !== "estadia" || papel !== "morador" || ctx.comContrato);
}

function acende(item: ItemAba, pathname: string): boolean {
  return [item.href, ...(item.ativoEm ?? [])].some((h) => !h.includes("#") && rotaAtiva(h, pathname));
}

/** A aba acesa nesta rota (a aba ou qualquer subaba dela); fora delas, nenhuma. */
export function abaAtivaPainel(abas: readonly AbaPainel[], pathname: string): AbaPainel | null {
  for (const aba of abas) {
    if (acende(aba, pathname) || (aba.subabas ?? []).some((s) => acende(s, pathname))) return aba;
  }
  // Abas-âncora (parceiro): a 1ª acende na própria página.
  const ancora = abas.find((a) => a.href.includes("#") && rotaAtiva(a.href.split("#")[0], pathname));
  return ancora ?? null;
}

/** A subaba acesa nesta rota (dentro da aba ativa). */
export function subabaAtivaPainel(abas: readonly AbaPainel[], pathname: string): ItemAba | null {
  const aba = abaAtivaPainel(abas, pathname);
  return (aba?.subabas ?? []).find((s) => acende(s, pathname)) ?? null;
}

/** Itens do menu da Conta (avatar): links, e as ações de troca de modo e de sair. */
export interface ItemConta extends ItemAba {
  acao?: "modo-morador" | "modo-proprietario" | "sair";
}

/**
 * E176 (mockups aprovados do menu): o avatar é um ATALHO CURTO — Minha conta · Modo <outro papel> · Ajuda · Sair. Perfil,
 * verificação, pagamentos, notificações, avaliações e plano moram dentro da Conta (um nome só para cada tela, E85).
 */
const MINHA_CONTA: ItemConta = { id: "conta", rotulo: "Minha conta", href: "/dashboard/conta" };
const AJUDA: ItemConta = { id: "ajuda", rotulo: "Ajuda", href: "/ajuda" };

/**
 * O menu da Conta por papel (o mesmo no "Conta ▾" do computador e no avatar do celular). MENUS-5, item 3: as
 * Ferramentas saem daqui (viram os cartões do Início do dono com "Todas as ferramentas").
 */
export function itensDaConta(papel: PapelAbas | null, p: { temImovel: boolean; admin?: boolean }): ItemConta[] {
  const itens: ItemConta[] = [MINHA_CONTA];
  if (papel === "proprietario") {
    itens.push({ id: "modo-morador", rotulo: "Modo morador", href: "/dashboard", acao: "modo-morador" });
  } else if (p.temImovel) {
    // Quem já anunciou troca de modo aqui. Morador puro não vê nada do dono (E167, QA 25/10: nem "Anunciar meu
    // imóvel" nem Ferramentas) — a porta de anunciar é a do site público.
    itens.push({ id: "modo-proprietario", rotulo: "Modo proprietário", href: "/dashboard", acao: "modo-proprietario" });
  }
  itens.push(AJUDA);
  // Só contas da equipe (fora dos 4 itens de morador/dono): é a única porta do painel para o /admin.
  if (p.admin) itens.push({ id: "admin", rotulo: "Painel admin", href: "/admin" });
  itens.push({ id: "sair", rotulo: "Sair", href: "/", acao: "sair" });
  return itens;
}

/** O sino do topo leva às notificações do painel (os avisos moram nele). */
export const HREF_SINO = "/dashboard/notificacoes";
