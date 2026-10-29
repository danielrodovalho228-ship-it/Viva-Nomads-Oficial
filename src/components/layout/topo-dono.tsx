"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { FileiraRolavel } from "@/components/ui/fileira-rolavel";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { HREF_SINO, abaAtivaPainel, subabaAtivaPainel, type AbaPainel, type ItemConta, type PapelAbas } from "@/config/abas-painel";

/**
 * Topo do painel no computador. PROP-1 (dono, mockup painel-proprietario-desktop) e MENUS-5/MORADOR-NAV (morador e
 * parceiro): logo, as abas do papel (fonte única config/abas-painel.ts, as mesmas da barra de baixo do celular), o
 * sino e "Conta ▾". Sem barra lateral. Só no computador (lg+); no celular, a barra de baixo e o avatar do topo.
 */

/** Prefixo dos test ids por papel (o do dono segue "dono", como no PROP-1). */
export const prefixoPapel = (papel: PapelAbas) => (papel === "proprietario" ? "dono" : papel);

const AREA: Record<PapelAbas, string> = { proprietario: "Áreas do proprietário", morador: "Áreas do morador", parceiro: "Áreas do parceiro" };

export function TopoPainel(p: {
  papel: PapelAbas;
  abas: readonly AbaPainel[];
  pathname: string;
  nome: string;
  foto: string | null;
  notificacoes?: number;
  itensConta: readonly ItemConta[];
  onAcao: (acao: NonNullable<ItemConta["acao"]>) => void;
}) {
  const ativa = abaAtivaPainel(p.abas, p.pathname);
  const px = prefixoPapel(p.papel);
  return (
    <header className="web-only hidden border-b border-line bg-white lg:block print:hidden" data-testid={`topo-${px}`} data-papel={p.papel}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-8">
        <Link href="/dashboard" aria-label="Início do painel" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label={AREA[p.papel]} className="flex h-full min-w-0 flex-1 items-stretch gap-6" data-testid={`abas-${px}`}>
          {p.abas.map((a) => {
            const on = ativa?.id === a.id;
            return (
              <Link
                key={a.id}
                href={a.href}
                aria-current={on ? "page" : undefined}
                data-testid={`aba-${px}-${a.id}`}
                className={cn(
                  "inline-flex items-center whitespace-nowrap border-b-2 text-sm font-semibold transition-colors",
                  on ? "border-forest text-forest" : "border-transparent text-ink hover:text-forest"
                )}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Sino px={px} notificacoes={p.notificacoes} />
          <MenuConta px={px} nome={p.nome} foto={p.foto} itens={p.itensConta} onAcao={p.onAcao} />
        </div>
      </div>
    </header>
  );
}

export function Sino({ px, notificacoes }: { px: string; notificacoes?: number }) {
  return (
    <Link
      href={HREF_SINO}
      aria-label={notificacoes ? `Notificações: ${notificacoes} novas` : "Notificações"}
      className="relative grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
      data-testid={`sino-${px}`}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {!!notificacoes && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-600" aria-hidden />}
    </Link>
  );
}

/**
 * O menu da Conta: no computador, "avatar + Conta ▾"; no celular (`compacto`), só o avatar (área de toque de 44 px),
 * com o MESMO conteúdo (MENUS-5, item 4).
 */
export function MenuConta(p: {
  px: string;
  nome: string;
  foto: string | null;
  itens: readonly ItemConta[];
  onAcao: (acao: NonNullable<ItemConta["acao"]>) => void;
  compacto?: boolean;
}) {
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
  const id = p.compacto ? `conta-${p.px}-celular` : `conta-${p.px}`;
  const classeItem = "flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";
  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={p.compacto ? "Abrir a Conta" : undefined}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
          p.compacto ? "min-w-11 justify-center" : "px-2"
        )}
        data-testid={id}
      >
        <Avatar name={p.nome} size={p.compacto ? 32 : 28} photoUrl={p.foto ?? undefined} />
        {!p.compacto && (
          <>
            Conta
            <ChevronDown className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-flutuante" data-testid={`menu-${id}`}>
          {p.itens.map((i) =>
            i.acao ? (
              <button
                key={i.id}
                type="button"
                role="menuitem"
                className={cn(classeItem, i.acao === "sair" && "border-t border-line")}
                data-testid={`${id}-${i.id}`}
                onClick={() => {
                  setAberto(false);
                  p.onAcao(i.acao!);
                }}
              >
                {i.rotulo}
              </button>
            ) : (
              <Link key={i.id} href={i.href} role="menuitem" className={classeItem} data-testid={`${id}-${i.id}`} onClick={() => setAberto(false)}>
                {i.rotulo}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Subabas da aba ativa, num componente só (computador e celular). Sem subabas: nada. */
export function SubabasPainel({ papel, abas, pathname }: { papel: PapelAbas; abas: readonly AbaPainel[]; pathname: string }) {
  const aba = abaAtivaPainel(abas, pathname);
  if (!aba?.subabas?.length) return null;
  const ativa = subabaAtivaPainel(abas, pathname);
  const px = prefixoPapel(papel);
  return (
    // E248: no celular a fileira mostra que há mais abas ("›" na borda) em vez de cortar "Recibos e nota…" em silêncio.
    <FileiraRolavel as="nav" aria-label={`Seções de ${aba.rotulo}`} classeExterna="-mx-4 mb-6 sm:mx-0" className="flex gap-2 border-b border-line px-4 sm:px-0" data-testid={`subabas-${px}`} data-aba={aba.id}>
      {aba.subabas.map((s) => {
        const on = ativa?.id === s.id;
        return (
          <Link
            key={s.id}
            href={s.href}
            aria-current={on ? "page" : undefined}
            data-testid={`subaba-${px}-${s.id}`}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors",
              on ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {s.rotulo}
          </Link>
        );
      })}
    </FileiraRolavel>
  );
}
