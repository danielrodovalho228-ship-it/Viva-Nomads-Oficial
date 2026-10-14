"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, ChevronDown } from "lucide-react";
import { PUBLIC_NAV } from "@/lib/constants";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PRINCIPAIS = PUBLIC_NAV.filter((i) => !i.mais);
const MAIS = PUBLIC_NAV.filter((i) => i.mais);

/** Menu "Mais" do desktop: fecha ao clicar fora, com Esc e ao escolher um link. */
function MenuMais() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="true"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md text-sm font-medium text-ink/75 transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Mais <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-52 -translate-x-1/2 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {MAIS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className="block whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-blue-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cabeçalho público (ordem c67e818f): o logo nunca encosta nos links (gap fixo
 * e `shrink-0`) e os botões nunca quebram. Os links completos só aparecem a
 * partir de 1280 px (xl), onde cabem com folga; abaixo disso, menu hambúrguer.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Reconhece a sessão: sem isto o cabeçalho mostrava "Entrar" mesmo logado.
  // `mounted` evita mismatch de hidratação (o servidor sempre renderiza o estado
  // deslogado; o cliente corrige após reidratar o store).
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  const loggedIn = mounted && !!user;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-shadow",
        scrolled
          ? "border-line bg-white/90 backdrop-blur-md shadow-sm"
          : "border-transparent bg-white"
      )}
    >
      <nav className="container-page flex h-18 items-center gap-10 py-3">
        <Logo className="shrink-0" />

        <div data-testid="nav-links" className="hidden min-w-0 flex-1 items-center gap-6 xl:flex">
          {PRINCIPAIS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm font-medium text-ink/75 transition-colors hover:text-blue-500"
            >
              {item.label}
            </Link>
          ))}
          {MAIS.length > 0 && <MenuMais />}
        </div>

        <div data-testid="nav-acoes" className="hidden shrink-0 items-center gap-2 xl:flex">
          {loggedIn ? (
            <ButtonLink href="/dashboard" variant="ghost" size="sm">
              <LayoutDashboard className="h-4 w-4" /> Meu painel
            </ButtonLink>
          ) : (
            <ButtonLink href="/auth" variant="ghost" size="sm">
              Entrar
            </ButtonLink>
          )}
          <ButtonLink href="/dashboard/imoveis/novo" variant="primary" size="sm">
            {loggedIn ? "Anunciar imóvel" : "Entrar para anunciar"}
          </ButtonLink>
        </div>

        <button
          className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-white xl:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-blue-50"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {loggedIn ? (
                <ButtonLink href="/dashboard" variant="secondary" onClick={() => setOpen(false)}>
                  <LayoutDashboard className="h-4 w-4" /> Meu painel
                </ButtonLink>
              ) : (
                <ButtonLink href="/auth" variant="secondary" onClick={() => setOpen(false)}>
                  Entrar
                </ButtonLink>
              )}
              <ButtonLink href="/dashboard/imoveis/novo" variant="primary" onClick={() => setOpen(false)}>
                {loggedIn ? "Anunciar imóvel" : "Entrar para anunciar"}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
