"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";

/**
 * Botão "Ajuda" fixo (canto inferior direito) em todas as páginas do SITE.
 * No app ele some (a Ajuda fica em Perfil — nada de inchar o app) e também nas
 * telas onde atrapalharia: a própria Central, o admin, o login e fluxos de etapas.
 */
const ESCONDER = ["/ajuda", "/admin", "/auth", "/dashboard/conta/ajuda", "/dashboard/imoveis/novo", "/dashboard/fechamento"];

export function BotaoAjuda() {
  const pathname = usePathname() ?? "/";
  if (ESCONDER.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return (
    <Link
      href="/ajuda"
      aria-label="Ajuda — perguntas frequentes e chamados"
      className="web-only fixed right-4 z-30 inline-flex items-center gap-2 rounded-full border border-sage-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest shadow-lg transition-colors hover:border-forest print:hidden md:right-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--ajuda-bottom, 1.5rem))" }}
    >
      <LifeBuoy className="h-4 w-4" /> Ajuda
    </Link>
  );
}
