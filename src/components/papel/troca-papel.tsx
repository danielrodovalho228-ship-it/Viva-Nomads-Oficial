"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { ROTULO_PAPEL_ATIVO, opcoesDeTroca, type Papel } from "@/lib/papel/papel-ativo";
import { useTrocaPapel } from "./use-troca-papel";
import { cn } from "@/lib/utils";

/**
 * PAPEL-B — o selo do topo (foto pequena + papel ativo) vira o menu de troca: "Você está como Proprietário",
 * "Usar como Morador" / "Usar como Parceiro" (só os papéis que a pessoa tem) e "Ver minha conta". Admin é Equipe, sem
 * troca (o selo só leva à Conta). Usado pela casca no lugar do link simples (PapelAtivo, Pista A).
 */
export function TrocaPapel({ papel, nome, foto }: { papel: Papel | null; nome: string; foto: string | null }) {
  const admin = useAuthStore((s) => s.user?.role === "admin");
  const { papeis, trocando, erro, trocar } = useTrocaPapel();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idMenu = useId();
  const rotulo = papel ? ROTULO_PAPEL_ATIVO[papel] : "Equipe";

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
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

  const selo = (
    <>
      <Avatar name={nome || rotulo} size={28} photoUrl={foto ?? undefined} />
      <span className={cn("transition-opacity duration-200", trocando && "opacity-40")}>{rotulo}</span>
    </>
  );

  // Equipe (admin nas telas de admin) ou sem papel: sem troca, o selo leva à Conta como antes.
  if (!papel || admin) {
    return (
      <Link
        href="/dashboard/conta"
        data-testid="papel-ativo"
        data-papel={papel ?? "admin"}
        aria-label={`Papel ativo: ${rotulo} (abre o Perfil)`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pr-1 text-sm font-semibold text-ink"
      >
        {selo}
      </Link>
    );
  }

  const opcoes = opcoesDeTroca(papel, papeis ?? [papel]);
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        data-testid="papel-ativo"
        data-papel={papel}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        aria-label={`Papel ativo: ${rotulo}. Trocar de papel`}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pr-1 text-sm font-semibold text-ink"
      >
        {selo}
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform duration-200", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div id={idMenu} role="menu" data-testid="papel-menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-white p-2 text-sm">
          <p className="px-3 py-2 text-muted">
            Você está como <strong className="text-ink">{rotulo}</strong>
          </p>
          {opcoes.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              data-testid={`papel-usar-${p}`}
              disabled={!!trocando}
              onClick={() => {
                setAberto(false);
                void trocar(p);
              }}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold text-ink hover:bg-sage-100 disabled:text-muted"
            >
              Usar como {ROTULO_PAPEL_ATIVO[p]}
            </button>
          ))}
          <Link
            href="/dashboard/conta"
            role="menuitem"
            data-testid="papel-ver-conta"
            onClick={() => setAberto(false)}
            className="flex min-h-11 items-center rounded-lg px-3 text-ink hover:bg-sage-100"
          >
            Ver minha conta
          </Link>
          {erro && (
            <p role="alert" className="px-3 py-2 text-red-700">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
