"use client";

import Link from "next/link";
import { VoltarCelular } from "@/components/ui/voltar-celular";
import { LINHA_FECHAMENTO_CONTA } from "@/lib/conta/secoes";
import { Bell, CircleHelp, CreditCard, FileText, Shield, Star, UserRound, Users } from "lucide-react";
import { SECOES_CONTA, itemDaSecao, type ItemSecao, type SecaoConta } from "@/lib/conta/secoes";
import { cn } from "@/lib/utils";
import { CASCA_SOMBRA_CARTOES, ROTULO_MENU_CONTA, SOMBRA_CARTAO_CONTA, TITULO_TELA_CONTA } from "@/lib/conta/visual-mockup";

const ICONES: Record<ItemSecao["icone"], React.ComponentType<{ className?: string }>> = {
  UserRound,
  Star,
  Users,
  FileText,
  Shield,
  Bell,
  CreditCard,
  CircleHelp,
};

/**
 * A1 — a casca das telas da Conta (mockups perfil-01..08): fundo areia, menu lateral "Conta" com as oito seções (a
 * ativa numa pílula verde) no computador; no celular, "‹ Conta" volta ao menu e o título fica no topo. Um H1 por tela
 * (o nome da seção). `lateral` (opcional) é a coluna da direita no computador (ex.: o espelho do Perfil).
 */
export function CascaConta({
  ativo,
  titulo,
  subtitulo,
  children,
  topoDireita,
  trilha,
  subtela,
}: {
  ativo: SecaoConta;
  /** H1 de uma subtela da seção (ex.: "Senha e duas etapas" dentro de Privacidade); sem ele, o nome da seção. */
  titulo?: string;
  subtitulo?: string;
  children: React.ReactNode;
  /** No Perfil, o título e o subtítulo ficam na coluna da direita (acima do espelho), como no desenho. */
  topoDireita?: boolean;
  /** "Conta › <seção>" acima do título no computador (mockup perfil-05). */
  trilha?: boolean;
  /** Tela dentro de uma seção (ex.: Segurança e verificações, em Privacidade): o voltar padrão é a seção, não a Conta. */
  subtela?: boolean;
}) {
  const atual = itemDaSecao(ativo);
  const cabecalho = (
    <header className={cn("min-w-0", topoDireita && "xl:hidden")} data-testid="conta-cabecalho">
      {trilha && (
        <nav aria-label="Trilha" className="mb-1 hidden text-base text-muted lg:block" data-testid="conta-trilha">
          <Link href="/dashboard/conta" className="hover:text-forest">
            Conta
          </Link>
          <span aria-hidden> › </span>
          <span aria-current="page">{atual.rotulo}</span>
        </nav>
      )}
      {/* Celular (mockups): a seta de voltar e o título na mesma linha, o título centralizado. */}
      <div className="relative flex min-h-11 items-center justify-center lg:justify-start">
        {/* E69: volta para onde a pessoa estava; aberta direto, para a Conta (ou a seção, numa subtela). Ter título
            próprio não faz da tela uma subtela ("Meus dados" é a seção Dados). */}
        <VoltarCelular padrao={subtela ? atual.href : "/dashboard/conta"} rotulo={subtela ? atual.rotulo : "Conta"} className="absolute left-0" />
        <h1 className={cn(TITULO_TELA_CONTA, "px-12 text-center lg:px-0 lg:text-left")} data-testid="conta-h1">
          {titulo ?? atual.rotulo}
        </h1>
      </div>
      {subtitulo && <p className="mt-1 text-center text-sm text-muted lg:text-left">{subtitulo}</p>}
    </header>
  );
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start", CASCA_SOMBRA_CARTOES)} data-conta-casca data-secao={ativo}>
      <nav aria-label="Conta" className={cn("hidden rounded-xl bg-white p-3 lg:sticky lg:top-24 lg:block", SOMBRA_CARTAO_CONTA)} data-testid="conta-menu-lateral">
        <p className={cn("px-3 pb-2 pt-1", ROTULO_MENU_CONTA)}>Conta</p>
        <ul className="grid gap-1">
          {SECOES_CONTA.map((s) => {
            const Icone = ICONES[s.icone];
            const on = s.id === ativo;
            return (
              <li key={s.id}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors",
                    on ? "bg-forest font-semibold text-white" : "text-ink hover:bg-surface-2",
                  )}
                  data-testid={`conta-menu-${s.id}`}
                >
                  <Icone className="h-5 w-5 shrink-0" aria-hidden /> {s.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">
        {!topoDireita && <div className="mb-6">{cabecalho}</div>}
        {topoDireita && <div className="mb-6 xl:hidden">{cabecalho}</div>}
        {children}
        <FechamentoConta />
      </div>
    </div>
  );
}

/**
 * E75 (padrão de fechamento, 24/10): toda tela da Conta e o menu terminam numa linha institucional curta, logo
 * depois do último cartão — sem altura forçada nem vão bege embaixo.
 */
export function FechamentoConta() {
  return (
    <p className="mt-8 text-center text-xs text-muted" data-testid="conta-fechamento">
      {LINHA_FECHAMENTO_CONTA}
    </p>
  );
}

/** Título e subtítulo da seção para a coluna da direita (Perfil no computador). */
export function TituloSecaoLateral({ ativo, subtitulo }: { ativo: SecaoConta; subtitulo: string }) {
  return (
    <header className="hidden xl:block" data-testid="conta-cabecalho-lateral">
      {/* No computador o H1 do Perfil fica aqui (o do topo some a partir de 1280 px, onde a coluna da direita aparece): um H1 visível por largura. */}
      <h1 className={TITULO_TELA_CONTA} data-testid="conta-h1-lateral">
        {itemDaSecao(ativo).rotulo}
      </h1>
      <p className="mt-1 text-sm text-muted">{subtitulo}</p>
    </header>
  );
}
