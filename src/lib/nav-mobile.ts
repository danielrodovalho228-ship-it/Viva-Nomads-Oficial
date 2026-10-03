import {
  Home,
  Search,
  Heart,
  MessageSquare,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
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
  /** Exige login — sem sessão, a aba leva a /auth?next=<href>. */
  authRequired?: boolean;
  /** Chave de contador (badge). Preenchido pela casca quando houver dado. */
  badge?: "mensagens" | "interessados";
}

/** Modo inquilino — 5 abas. */
export const TENANT_TABS: MobileTab[] = [
  { href: "/home", label: "Início", icon: Home },
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
