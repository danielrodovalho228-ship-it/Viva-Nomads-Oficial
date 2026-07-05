"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { PUBLIC_NAV } from "@/lib/constants";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

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
      <nav className="container-page flex h-18 items-center justify-between py-3">
        <Logo />

        <div className="hidden items-center gap-8 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink/75 transition-colors hover:text-blue-500"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {loggedIn ? (
            <ButtonLink href="/dashboard" variant="ghost" size="sm">
              <LayoutDashboard className="h-4 w-4" /> Meu painel
            </ButtonLink>
          ) : (
            <ButtonLink href="/auth" variant="ghost" size="sm">
              Entrar
            </ButtonLink>
          )}
          <ButtonLink href="/qualificar" variant="accent" size="sm">
            Anunciar imóvel
          </ButtonLink>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-lg text-ink lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-white lg:hidden">
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
                <ButtonLink href="/dashboard" variant="outline" onClick={() => setOpen(false)}>
                  <LayoutDashboard className="h-4 w-4" /> Meu painel
                </ButtonLink>
              ) : (
                <ButtonLink href="/auth" variant="outline" onClick={() => setOpen(false)}>
                  Entrar
                </ButtonLink>
              )}
              <ButtonLink href="/qualificar" variant="accent" onClick={() => setOpen(false)}>
                Anunciar imóvel
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
