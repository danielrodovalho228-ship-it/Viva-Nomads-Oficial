"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ABAS_DONO, CONTA_DONO, HREF_SINO_DONO, abaAtivaDono, subabaAtivaDono, type ItemContaDono } from "@/config/nav-dono";

/**
 * PROP-1 — topo do dono no computador (mockup painel-proprietario-desktop): logo, as cinco abas, o sino e "Conta ▾".
 * Só no computador (lg+) e só no modo dono; no celular seguem a barra de abas e o menu do NAV-A.
 */
export function TopoDono(p: {
  pathname: string;
  nome: string;
  foto: string | null;
  notificacoes?: number;
  /** Admin: um item "Painel admin" no fim do menu da Conta (a barra do admin é o ADMIN-1). */
  admin?: boolean;
  onModoMorador: () => void;
  onSair: () => void;
}) {
  const ativa = abaAtivaDono(p.pathname);
  return (
    <header className="web-only hidden border-b border-line bg-white lg:block print:hidden" data-testid="topo-dono">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-8">
        <Link href="/dashboard" aria-label="Início do painel" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Áreas do proprietário" className="flex h-full min-w-0 flex-1 items-stretch gap-6" data-testid="abas-dono">
          {ABAS_DONO.map((a) => {
            const on = ativa?.id === a.id;
            return (
              <Link
                key={a.id}
                href={a.href}
                aria-current={on ? "page" : undefined}
                data-testid={`aba-dono-${a.id}`}
                className={cn(
                  "inline-flex items-center border-b-2 text-sm font-semibold transition-colors",
                  on ? "border-forest text-forest" : "border-transparent text-ink hover:text-forest"
                )}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={HREF_SINO_DONO}
            aria-label={p.notificacoes ? `Notificações: ${p.notificacoes} novas` : "Notificações"}
            className="relative grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            data-testid="sino-dono"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {!!p.notificacoes && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-600" aria-hidden />}
          </Link>
          <MenuConta {...p} />
        </div>
      </div>
    </header>
  );
}

function MenuConta(p: { nome: string; foto: string | null; admin?: boolean; onModoMorador: () => void; onSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  const itens: ItemContaDono[] = p.admin ? [...CONTA_DONO.slice(0, -1), { id: "admin", rotulo: "Painel admin", href: "/admin" }, CONTA_DONO[CONTA_DONO.length - 1]] : [...CONTA_DONO];
  const classeItem = "flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";
  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        data-testid="conta-dono"
      >
        <Avatar name={p.nome} size={28} photoUrl={p.foto ?? undefined} />
        Conta
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-flutuante" data-testid="menu-conta-dono">
          {itens.map((i) =>
            i.acao ? (
              <button
                key={i.id}
                type="button"
                role="menuitem"
                className={cn(classeItem, i.acao === "sair" && "border-t border-line")}
                data-testid={`conta-dono-${i.id}`}
                onClick={() => {
                  setAberto(false);
                  if (i.acao === "modo-morador") p.onModoMorador();
                  else p.onSair();
                }}
              >
                {i.rotulo}
              </button>
            ) : (
              <Link key={i.id} href={i.href} role="menuitem" className={classeItem} data-testid={`conta-dono-${i.id}`} onClick={() => setAberto(false)}>
                {i.rotulo}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Subabas da aba ativa (Interessados e Contratos), num componente só. Sem subabas: nada. */
export function SubabasDono({ pathname }: { pathname: string }) {
  const aba = abaAtivaDono(pathname);
  if (!aba?.subabas?.length) return null;
  const ativa = subabaAtivaDono(pathname);
  return (
    <nav aria-label={`Seções de ${aba.rotulo}`} className="mb-6 flex gap-2 overflow-x-auto border-b border-line" data-testid="subabas-dono" data-aba={aba.id}>
      {aba.subabas.map((s) => {
        const on = ativa?.id === s.id;
        return (
          <Link
            key={s.id}
            href={s.href}
            aria-current={on ? "page" : undefined}
            data-testid={`subaba-dono-${s.id}`}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
              on ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {s.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
