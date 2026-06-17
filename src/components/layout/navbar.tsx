"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PUBLIC_NAV } from "@/lib/constants";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-sage-200 bg-white/90 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-7 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink/80 transition-colors hover:text-forest"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ButtonLink href="/auth" variant="ghost" size="sm">
            Entrar
          </ButtonLink>
          <ButtonLink href="/qualificar" variant="gold" size="sm">
            Anunciar imóvel
          </ButtonLink>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-lg text-forest md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-sage-200 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-sage-100"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <ButtonLink href="/auth" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Entrar
              </ButtonLink>
              <ButtonLink href="/qualificar" variant="gold" size="sm" onClick={() => setOpen(false)}>
                Anunciar imóvel
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
