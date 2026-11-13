"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILEIRA_ABAS } from "@/components/ui/abas-fileira";

/**
 * Abas do hub "Favoritos & comparações": Favoritos e Comparações, que a subaba "Favoritos" do menu do morador
 * (config/abas-painel.ts) junta numa só. Buscas salvas tem a própria subaba — repetir aqui empilhava duas barras
 * (varredura 17, 05/11). Usada no topo de Favoritos e de Comparações.
 */
const TABS = [
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
  { href: "/dashboard/comparar", label: "Comparações", icon: GitCompare },
];

export function FavoritosTabs() {
  const pathname = usePathname();
  return (
    <div className={cn("mb-6", FILEIRA_ABAS)} data-testid="favoritos-abas">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
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
