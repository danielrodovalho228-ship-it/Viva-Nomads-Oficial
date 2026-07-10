"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, GitCompare, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Abas do hub "Favoritos & comparações" — reúne Favoritos, Comparações e Buscas
 * salvas num só item de menu (as rotas seguem vivas, agora como seções). Usada
 * no topo das três páginas.
 */
const TABS = [
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
  { href: "/dashboard/comparar", label: "Comparações", icon: GitCompare },
  { href: "/dashboard/buscas", label: "Buscas salvas", icon: Search },
];

export function FavoritosTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-sage-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-forest text-forest"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
