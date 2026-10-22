"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useIsNative } from "@/lib/use-native";
import { isFlowRoute, abasDoPapel, papelDaBarra, type MobileTab, type PapelBarra } from "@/lib/nav-mobile";
import { useParceiroAprovado, usePreferenciaParceiro } from "@/lib/use-papel-barra";
import { cn } from "@/lib/utils";

/**
 * Barra inferior por PAPEL (Prompt 41, item 2): 5 itens para o morador, o proprietário e o parceiro aprovado; o
 * admin só não tem barra nas telas /admin (no painel, a do modo ativo — D-V). A mesma lista no site (celular, < md) e no app (qualquer largura, CSS .vn-tabbar). Esconde-se
 * nas telas de fluxo (isFlowRoute). Flutua sobre a página: sombra única --shadow-flutuante (adendo ao 40).
 * Abas que exigem login, sem sessão, levam a /auth?redirect= (o Início do visitante é a home).
 *
 * `world` vem da casca (modo do painel) ou da página pública ("tenant"); com sessão vale o modo ATIVO da conta.
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
  const parceiroAprovado = useParceiroAprovado();
  const preferenciaParceiro = usePreferenciaParceiro();

  // Telas de fluxo não mostram a barra (mostram o MobileHeader).
  if (isFlowRoute(pathname)) return null;

  const modo: "tenant" | "owner" = user ? (activeMode ?? world) : "tenant";
  const papel = papelDaBarra({ admin: user?.role === "admin", modo, parceiroAprovado, preferenciaParceiro, pathname });
  const tabs = abasDoPapel(papel);
  if (!papel || tabs.length === 0) return null;

  function isActive(tab: MobileTab): boolean {
    const [rota, ancora] = tab.href.split("#");
    if (tab.ativoEm && (pathname === tab.ativoEm || pathname.startsWith(tab.ativoEm + "/"))) return true;
    // Abas do parceiro são âncoras da mesma página: acende só a 1ª (Pedidos) na própria página.
    if (ancora) return pathname === rota && ancora === "pedidos";
    if (pathname === rota) return true;
    // Abas "raiz" não acendem em sub-rotas (senão Início ficaria sempre ativo).
    if (rota === "/" || rota === "/dashboard") return false;
    return pathname.startsWith(rota + "/");
  }

  function barra(papelAtivo: PapelBarra, className: string, label: string) {
    const activeColor = papelAtivo === "proprietario" ? "#7a4a12" : "var(--color-forest)";
    return (
      <nav
        aria-label={label}
        data-papel={papelAtivo}
        className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-flutuante print:hidden", className)}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            const href = tab.authRequired && !user ? (tab.hrefSemLogin ?? `/auth?redirect=${encodeURIComponent(tab.href)}`) : tab.href;
            const count = tab.badge ? badges?.[tab.badge] ?? 0 : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={tab.descricao}
                  title={tab.descricao}
                  className="relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold text-muted"
                  style={active ? { color: activeColor } : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <span
                        className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-champagne px-1 text-[10px] font-semibold tabular-nums text-forest"
                        aria-label={`${count} ${tab.badge === "mensagens" ? "não lidas" : tab.badge === "equipe" ? "pendentes" : "novos"}`}
                      >
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </span>
                  <span className="block w-full truncate px-1 text-center">{tab.label}</span>
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
      {/* Site no celular (navegador): some no desktop. */}
      {barra(papel, cn("web-only", native ? "" : "md:hidden"), "Navegação principal")}
      {/* Dentro do app: as mesmas 5 abas, em qualquer largura (CSS .vn-tabbar). */}
      {barra(papel, "vn-tabbar hidden", "Abas do app")}
    </>
  );
}
