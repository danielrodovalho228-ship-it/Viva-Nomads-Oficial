"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
  Heart,
  Search,
  ClipboardCheck,
  ShieldCheck,
  FileSignature,
  BadgeCheck,
  GitCompare,
  Gift,
  Wrench,
  Briefcase,
  Calculator,
  FileText,
  RotateCcw,
  Menu,
  LogOut,
  Building2,
  User,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, DEMO_USER, type ViewMode } from "@/lib/store";
import { useViewMode, MODE_META } from "@/lib/roles";
import { useDemoMode, DemoToggle, DemoBanner } from "@/lib/demo/demo-mode";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Plano mínimo para exibir o item (operador / Gestor). */
  minPlan?: "gestor";
}

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/qualificar", label: "Qualificar imóvel", icon: ClipboardCheck },
  { href: "/dashboard/imoveis", label: "Meus imóveis", icon: Home },
  { href: "/dashboard/carteira", label: "Carteira", icon: Briefcase, minPlan: "gestor" },
  { href: "/dashboard/viabilidade", label: "Viabilidade", icon: Calculator, minPlan: "gestor" },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/dashboard/fechamento", label: "Fechamento", icon: FileSignature },
  { href: "/dashboard/reembolsos", label: "Reembolsos", icon: RotateCcw },
  { href: "/dashboard/solicitacoes", label: "Solicitações", icon: Wrench },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/dashboard/indicacoes", label: "Indicações", icon: Gift },
  { href: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/dashboard/conta", label: "Conta", icon: Settings },
];

const TENANT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/verificacao", label: "Inquilino Verificado", icon: BadgeCheck },
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
  { href: "/dashboard/comparar", label: "Comparar", icon: GitCompare },
  { href: "/dashboard/solicitacoes", label: "Solicitações", icon: Wrench },
  { href: "/dashboard/buscas", label: "Buscas salvas", icon: Search },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/dashboard/indicacoes", label: "Indicações", icon: Gift },
  { href: "/dashboard/conta", label: "Conta", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

const NAV_BY_MODE: Record<ViewMode, NavItem[]> = { owner: OWNER_NAV, tenant: TENANT_NAV };

/** Para onde o convite leva ao ativar o segundo papel. */
/** Ícone de cada mundo no seletor de modo. */
const MODE_ICON: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  owner: Building2,
  tenant: User,
};

/** Rotas exclusivas de cada papel (a verificação é compartilhada — adapta por
 *  modo). Acessá-las por URL no modo errado redireciona para a Visão geral. */
const OWNER_ONLY = [
  "/qualificar",
  "/dashboard/imoveis",
  "/dashboard/carteira",
  "/dashboard/viabilidade",
  "/dashboard/leads",
  "/dashboard/orcamentos",
  "/dashboard/fechamento",
  "/dashboard/reembolsos",
  "/dashboard/assinatura",
];
const TENANT_ONLY = ["/dashboard/favoritos", "/dashboard/comparar", "/dashboard/buscas"];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, setActiveMode } = useAuthStore();
  const { mode } = useViewMode();

  // Em modo demo (sem login), exibe uma identidade coerente (A5/A6).
  const display = user ?? DEMO_USER;
  const plan = display.plan ?? "free";

  let nav = NAV_BY_MODE[mode];
  if (display.role === "admin" && mode === "owner") nav = [...OWNER_NAV, ...ADMIN_NAV];
  // Itens de operador só aparecem no plano Gestor.
  nav = nav.filter((item) => !item.minPlan || plan === item.minPlan);

  // Guarda de rota por papel: acessar por URL uma tela exclusiva do OUTRO modo
  // redireciona para a Visão geral. Rotas compartilhadas (mensagens, conta,
  // indicações, solicitações, verificação) seguem acessíveis nos dois modos.
  useEffect(() => {
    const exclusive = mode === "owner" ? TENANT_ONLY : OWNER_ONLY;
    if (exclusive.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
      router.replace("/dashboard");
    }
  }, [pathname, mode, router]);

  // Modo demonstração (admin): aceita ?demo=1 / ?demo=0 na URL (estado é de
  // sessão — lib/demo/demo-mode). Lê window.location para não exigir Suspense.
  const { admin, setOn: setDemoOn } = useDemoMode();
  useEffect(() => {
    if (!admin) return;
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") setDemoOn(true);
    else if (q === "0") setDemoOn(false);
  }, [admin, setDemoOn]);

  function handleSignOut() {
    signOut();
    router.push("/home");
  }

  function switchTo(next: ViewMode) {
    setActiveMode(next);
    setOpen(false);
    // Se a tela atual não existe no novo modo, volta para a Visão geral
    // (evita ficar numa rota do outro papel após a troca).
    const allowed = NAV_BY_MODE[next].some((item) => item.href === pathname);
    if (!allowed) router.push("/dashboard");
  }

  const meta = MODE_META[mode];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-white/10 px-4">
        <Logo light className="max-w-full" />
      </div>
      <nav key={mode} className="mode-transition flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-champagne text-forest"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={display.name} size={36} mode={mode} />
          <div className="min-w-0 text-xs">
            <p className="truncate font-medium text-white">{display.name}</p>
            <p className="text-white/60">Conta: {labelForRole(display.role)}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-surface-2">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 bg-forest lg:block print:hidden">{sidebar}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-forest">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile (logo + menu) */}
        <div className="flex h-16 items-center justify-between border-b border-sage-200 bg-white px-4 lg:hidden print:hidden">
          <Logo />
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-forest"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Aviso fixo do modo demonstração (só aparece quando ligado). */}
        <DemoBanner />

        {/* Barra de modo: seletor sempre visível (proprietário ⇄ inquilino). */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sage-200 bg-white px-5 py-2.5 sm:px-8 print:hidden">
          <p className="hidden items-center gap-2 text-sm text-muted sm:flex">
            Você está no modo
            <span
              key={mode}
              className={cn(
                "mode-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                meta.accentBg,
                meta.accentText
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.accentDot)} aria-hidden />
              {meta.label}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {/* Toggle do modo demonstração — renderiza apenas para o admin. */}
            <DemoToggle />
            <ModeSwitcher mode={mode} onSwitch={switchTo} />
          </div>
        </div>

        <main key={mode} className="mode-transition flex-1 p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Seletor de modo estilo Airbnb: pílula segmentada com dois mundos
 * (Proprietário ⇄ Inquilino) e um indicador que desliza com animação para o
 * lado ativo. Sempre visível — um clique alterna o mundo.
 */
function ModeSwitcher({ mode, onSwitch }: { mode: ViewMode; onSwitch: (m: ViewMode) => void }) {
  const modes: ViewMode[] = ["owner", "tenant"];
  return (
    <div
      role="tablist"
      aria-label="Alternar entre Proprietário e Inquilino"
      className="relative grid w-[16.5rem] grid-cols-2 rounded-full border border-sage-200 bg-surface-2 p-1"
    >
      {/* Indicador deslizante (animação estilo Airbnb) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out"
        style={{ transform: mode === "tenant" ? "translateX(100%)" : "translateX(0)" }}
      />
      {modes.map((m) => {
        const meta = MODE_META[m];
        const Icon = MODE_ICON[m];
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onSwitch(m)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200",
              active ? meta.accentText : "text-muted hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function labelForRole(role: string) {
  if (role === "owner") return "Proprietário";
  if (role === "tenant") return "Inquilino";
  return "Administrador";
}
