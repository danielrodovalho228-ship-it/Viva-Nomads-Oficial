"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useIsNative } from "@/lib/use-native";
import {
  isFlowRoute,
  TENANT_TABS,
  OWNER_TABS,
  TENANT_APP_TABS,
  OWNER_APP_TABS,
  type MobileTab,
} from "@/lib/nav-mobile";
import { cn } from "@/lib/utils";

/**
 * Barra inferior do app (Fase 1b). Visível só em telas < md OU dentro do app
 * nativo (Capacitor) — no desktop o layout atual continua. Esconde-se sozinha
 * nas telas de fluxo (isFlowRoute). Acento verde (inquilino) ou âmbar
 * (proprietário). Abas que exigem login, sem sessão, levam a /auth?next=.
 *
 * Recebe só `world` (string serializável): a lista de abas tem `icon` (função),
 * que NÃO pode cruzar a fronteira server→client como prop — então a escolhemos
 * aqui dentro (client).
 */
export function MobileTabBar({
  world,
  badges,
}: {
  world: "tenant" | "owner";
  badges?: Partial<Record<NonNullable<MobileTab["badge"]>, number>>;
}) {
  const pathname = usePathname();
  const native = useIsNative();
  const user = useAuthStore((s) => s.user);
  const activeMode = useAuthStore((s) => s.activeMode);

  // Telas de fluxo não mostram a barra (mostram o MobileHeader).
  if (isFlowRoute(pathname)) return null;

  // Modo app: o mundo segue o papel ATIVO de quem está logado (também nas
  // páginas públicas, ex.: proprietário vendo um anúncio); sem login, inquilino.
  const appWorld: "tenant" | "owner" = user ? (activeMode === "owner" ? "owner" : activeMode === "tenant" ? "tenant" : world) : "tenant";

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    // Abas "raiz" não acendem em sub-rotas (senão Painel/Início ficariam sempre ativos).
    if (href === "/" || href === "/dashboard") return false;
    return pathname.startsWith(href + "/");
  }

  function barra(tabs: MobileTab[], mundo: "tenant" | "owner", className: string, label: string) {
    const activeColor = mundo === "owner" ? "#7a4a12" : "var(--color-forest)";
    return (
      <nav
        aria-label={label}
        className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface print:hidden", className)}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            const href =
              tab.authRequired && !user ? `/auth?redirect=${encodeURIComponent(tab.href)}` : tab.href;
            const count = tab.badge ? badges?.[tab.badge] ?? 0 : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted"
                  style={active ? { color: activeColor } : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <span
                        className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-champagne px-1 text-[10px] font-bold text-forest"
                        aria-label={`${count} ${tab.badge === "mensagens" ? "não lidas" : "novos"}`}
                      >
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <>
      {/* Site no celular (navegador): barra atual, some no desktop. */}
      {barra(world === "owner" ? OWNER_TABS : TENANT_TABS, world, cn("web-only", native ? "" : "md:hidden"), "Navegação principal")}
      {/* Dentro do app: 5 abas do papel, em qualquer largura (CSS .vn-tabbar). */}
      {barra(appWorld === "owner" ? OWNER_APP_TABS : TENANT_APP_TABS, appWorld, "vn-tabbar hidden", "Abas do app")}
    </>
  );
}
