"use client";

import Link from "next/link";
import { Bell, ChevronRight, CircleHelp, CreditCard, FileText, LogOut, Shield, ShieldCheck, Star, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECOES_CONTA, type ItemSecao } from "@/lib/conta/secoes";
import { useSair } from "./use-sair";
import { FechamentoConta } from "./casca-conta";

const ICONES_SECAO: Record<ItemSecao["icone"], React.ComponentType<{ className?: string }>> = {
  UserRound,
  Star,
  Users,
  FileText,
  Shield,
  ShieldCheck,
  Bell,
  CreditCard,
  CircleHelp,
};

type Grupo = { titulo: string | null; itens: Item[] };
type Item = { href?: string; onClick?: () => void; label: string; descricao?: string; icon: React.ComponentType<{ className?: string }>; tom?: "perigo" };

/**
 * A Conta no CELULAR (site e app; A1, mockups perfil-01..08): o grupo "Conta" com as oito seções — cada uma abre a sua
 * tela com "‹ Conta" — e Sair. NAV-A (24/10): só a pessoa; o trabalho fica na barra verde (e na barra de abas).
 */
export function ContaMenu() {
  const sair = useSair();

  // A1: o grupo "Conta" são as oito seções (a mesma lista do menu lateral do computador, lib/conta/secoes).
  const grupos: Grupo[] = [
    {
      titulo: "Conta",
      itens: SECOES_CONTA.map((s) => ({ href: s.href, label: s.rotuloMenu ?? s.rotulo, descricao: s.descricao, icon: ICONES_SECAO[s.icone] })),
    },
    {
      // NAV-A: a Conta é só a PESSOA. Avisos (sino do topo), Verificação, Ferramentas, Indicações, Painel Admin e Equipe
      // moram na barra verde de trabalho; Termos e Privacidade, na Ajuda. Sair fecha a lista.
      titulo: null,
      itens: [{ onClick: sair, label: "Sair", descricao: "Encerrar a sessão neste aparelho.", icon: LogOut, tom: "perigo" }],
    },
  ];

  return (
    <div className="w-full space-y-4" data-testid="conta-menu">
      {/* A1: no celular (site e app) a Conta abre neste menu; cada seção é uma tela com "‹ Conta". */}
      <h1 className="font-title text-[28px] font-semibold leading-tight text-ink" data-testid="conta-h1">
        Conta
      </h1>
      {grupos
        .filter((g) => g.itens.length > 0)
        .map((g, i) => (
          <section key={i} aria-label={g.titulo ?? "Mais"} data-testid="conta-grupo" data-grupo={g.titulo ?? "mais"}>
          {/* E238: o grupo "Conta" não repete o título da tela logo abaixo dele ("Conta" uma vez só); o nome fica no
              aria-label da seção para o leitor de tela. */}
          {g.titulo && g.titulo !== "Conta" && <h2 className="mb-2 font-title text-base font-semibold text-ink">{g.titulo}</h2>}
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {g.itens.map((it) => {
              const Icon = it.icon;
              const conteudo = (
                <>
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", it.tom === "perigo" ? "text-red-600" : "text-forest")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", it.tom === "perigo" ? "text-red-700" : "text-ink")}>
                      {it.label}
                    </span>
                    {it.descricao && <span className="block truncate text-xs text-muted">{it.descricao}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </>
              );
              const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left";
              return (
                <li key={it.label}>
                  {it.href ? (
                    <Link href={it.href} className={cls}>
                      {conteudo}
                    </Link>
                  ) : (
                    <button type="button" onClick={it.onClick} className={cls}>
                      {conteudo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          </section>
        ))}
      <FechamentoConta />
    </div>
  );
}
