"use client";

import { useEffect, useState } from "react";
import { useMontado } from "@/lib/use-client-state";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { FALE_COM_A_VIVA, PUBLIC_NAV } from "@/lib/constants";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { Avatar } from "@/components/ui/avatar";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { primeiroNomeExibicao } from "@/lib/roles";
import { cn } from "@/lib/utils";

const LINK = "whitespace-nowrap text-sm font-medium text-ink/75 transition-colors hover:text-forest";

/**
 * "Meu painel" com a foto (ou as iniciais) de quem está logado, como o "My
 * Dashboard" do Furnished Finder (ordem 0ee6d5f6). Sem foto, o Avatar mostra as iniciais.
 */
function MeuPainel({ nome, foto, onClick, className }: { nome: string; foto: string | null; onClick?: () => void; className?: string }) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      data-testid="nav-meu-painel"
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg pl-2 pr-4 text-sm font-semibold text-forest transition-colors hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
        className
      )}
    >
      <Avatar name={nome} size={30} photoUrl={foto ?? undefined} />
      Meu painel
    </Link>
  );
}

/**
 * Cabeçalho público — E176 (PUBLICO-A, mockups aprovados): Imóveis · Anunciar · Empresas + "Fale com a Viva" em texto
 * + Entrar (logado: "Meu painel"). Fundo clean, verde da marca. O cabeçalho NÃO some na /buscar: logo, links e conta
 * ficam (como no Furnished Finder). Abaixo de 1024 px, o mesmo conteúdo no menu hambúrguer.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Reconhece a sessão: sem isto o cabeçalho mostrava "Entrar" mesmo logado.
  // `mounted` evita mismatch de hidratação (o servidor sempre renderiza o estado
  // deslogado; o cliente corrige após reidratar o store).
  const user = useAuthStore((s) => s.user);
  const mounted = useMontado();
  const loggedIn = mounted && !!user;

  // Foto do próprio usuário (opcional) para o "Meu painel".
  const [foto, setFoto] = useState<string | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!mounted || !userId) return;
    let vivo = true;
    getMyAvatarUrl()
      .then((r) => {
        if (vivo) setFoto(r.url);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [mounted, userId]);
  // CONTA-A: só o nome do perfil vira rosto; sem nome, a silhueta.
  const nome = primeiroNomeExibicao(user);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-white transition-shadow", scrolled ? "border-line shadow-flutuante" : "border-transparent")} data-testid="topo-publico">
      <nav className="flex h-18 w-full items-center gap-8 px-4 py-3 sm:px-8 2xl:gap-12 2xl:px-12">
        <Logo className="shrink-0" />

        <div data-testid="nav-links" className="hidden min-w-0 flex-1 items-center gap-6 lg:flex 2xl:gap-8">
          {PUBLIC_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={LINK}>
              {item.label}
            </Link>
          ))}
        </div>

        <div data-testid="nav-acoes" className="hidden shrink-0 items-center gap-4 lg:flex">
          <Link href={FALE_COM_A_VIVA.href} className={LINK} data-testid="nav-fale-com-a-viva">
            {FALE_COM_A_VIVA.label}
          </Link>
          {loggedIn ? (
            <MeuPainel nome={nome} foto={foto} />
          ) : (
            <ButtonLink href="/auth" variant="primary" size="sm" data-testid="nav-entrar">
              Entrar
            </ButtonLink>
          )}
        </div>

        <button
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          data-testid="nav-menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-white lg:hidden" data-testid="nav-menu-lista">
          <div className="flex flex-col gap-1 px-4 py-4 sm:px-8">
            {PUBLIC_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-sage-50" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href={FALE_COM_A_VIVA.href} className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-sage-50" onClick={() => setOpen(false)}>
              {FALE_COM_A_VIVA.label}
            </Link>
            <div className="mt-2 flex flex-col gap-2">
              {loggedIn ? (
                <MeuPainel nome={nome} foto={foto} onClick={() => setOpen(false)} className="h-12 justify-center border border-forest" />
              ) : (
                <ButtonLink href="/auth" variant="primary" onClick={() => setOpen(false)}>
                  Entrar
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
