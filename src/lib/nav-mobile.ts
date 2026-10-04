import {
  Home,
  Search,
  Heart,
  MessageSquare,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  FileText,
  UserRound,
} from "lucide-react";

/**
 * Abas da BARRA INFERIOR do app (Fase 1b) — conjunto reduzido por modo, separado
 * dos menus laterais do painel. Dois "mundos" pela mesma conta (seção 2.1 do
 * mapa): inquilino e proprietário.
 */
export interface MobileTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Exige login — sem sessão, a aba leva a /auth?redirect=<href>. */
  authRequired?: boolean;
  /** Chave de contador (badge). Preenchido pela casca quando houver dado. */
  badge?: "mensagens" | "interessados";
}

/** Modo inquilino — 5 abas. */
export const TENANT_TABS: MobileTab[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart, authRequired: true },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, authRequired: true, badge: "mensagens" },
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard, authRequired: true },
];

/** Modo proprietário — 5 abas. */
export const OWNER_TABS: MobileTab[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/dashboard/leads", label: "Interessados", icon: Users, badge: "interessados" },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, badge: "mensagens" },
  { href: "/dashboard/conta", label: "Conta", icon: Settings },
];

/**
 * MODO APP (Android/iPhone) — 5 abas por papel (mapa de telas, seções 2 e 3).
 * Inquilino abre em Buscar; proprietário, no Painel. A troca de papel fica em Conta.
 */
export const TENANT_APP_TABS: MobileTab[] = [
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart, authRequired: true },
  { href: "/dashboard/candidaturas", label: "Candidaturas", icon: FileText, authRequired: true },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, authRequired: true, badge: "mensagens" },
  { href: "/dashboard/conta", label: "Conta", icon: UserRound, authRequired: true },
];

export const OWNER_APP_TABS: MobileTab[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/dashboard/leads", label: "Interessados", icon: Users, badge: "interessados" },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, badge: "mensagens" },
  { href: "/dashboard/conta", label: "Conta", icon: UserRound },
];

/** Títulos das telas no cabeçalho curto do app. */
const TITULOS_APP: [RegExp, string][] = [
  [/^\/dashboard\/?$/, "Painel"],
  [/^\/dashboard\/imoveis\/novo/, "Anunciar imóvel"],
  [/^\/dashboard\/imoveis\/[^/]+\/editar/, "Editar anúncio"],
  [/^\/dashboard\/imoveis/, "Imóveis"],
  [/^\/dashboard\/leads/, "Interessados"],
  [/^\/dashboard\/mensagens/, "Mensagens"],
  [/^\/dashboard\/favoritos/, "Favoritos"],
  [/^\/dashboard\/comparar/, "Comparar"],
  [/^\/dashboard\/candidaturas/, "Candidaturas"],
  [/^\/dashboard\/pedidos-cidade/, "Pedidos na cidade"],
  [/^\/dashboard\/pedidos/, "Meus pedidos"],
  [/^\/dashboard\/conta\/perfil/, "Perfil"],
  [/^\/dashboard\/conta\/seguranca/, "Senha e segurança"],
  [/^\/dashboard\/conta\/notificacoes/, "Notificações"],
  [/^\/dashboard\/conta\/ajuda/, "Ajuda e contato"],
  [/^\/dashboard\/conta\/excluir/, "Excluir conta"],
  [/^\/dashboard\/conta/, "Conta"],
  [/^\/dashboard\/verificacao/, "Verificação"],
  [/^\/dashboard\/ferramentas/, "Ferramentas"],
  [/^\/dashboard\/assinatura/, "Plano"],
  [/^\/dashboard\/indicacoes/, "Indicações"],
  [/^\/dashboard\/fechamento/, "Fechamento"],
  [/^\/dashboard\/contratos/, "Contratos"],
  [/^\/dashboard\/locacoes/, "Minha estadia"],
  [/^\/dashboard\/solicitacoes/, "Chamados"],
  [/^\/dashboard\/orcamentos/, "Orçamentos"],
  [/^\/buscar/, "Buscar"],
  [/^\/imoveis\//, "Anúncio"],
  [/^\/pedidos\/novo/, "Novo pedido de moradia"],
  [/^\/termos/, "Termos de uso"],
  [/^\/privacidade/, "Privacidade"],
];

export function tituloDaTelaApp(pathname: string): string {
  for (const [re, t] of TITULOS_APP) if (re.test(pathname)) return t;
  return "Viva Nomads";
}

/** Abas principais do app (sem botão Voltar no cabeçalho). */
export function ehAbaRaizApp(pathname: string): boolean {
  return [...TENANT_APP_TABS, ...OWNER_APP_TABS].some((t) => t.href === pathname);
}

/**
 * Telas de FLUXO escondem a barra inferior (seção 2.1): filtros, candidatar-se,
 * conversa, anunciar imóvel, qualificação e fechamento. Mostram cabeçalho de
 * fluxo (voltar + ação) em vez da barra.
 */
export function isFlowRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/imoveis/novo") ||
    /^\/dashboard\/imoveis\/[^/]+\/editar/.test(pathname) ||
    pathname.startsWith("/qualificar") ||
    pathname.startsWith("/dashboard/fechamento") ||
    /^\/imoveis\/[^/]+\/candidatar/.test(pathname)
  );
}
