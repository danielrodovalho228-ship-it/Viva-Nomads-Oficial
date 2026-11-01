import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { carregarAgendaDoDono } from "@/lib/data/agenda-servidor";
import { estadoDosPapeis } from "@/lib/data/papel-actions";
import { agendaNoPapelMorador, TEXTOS_AGENDA_MORADOR } from "@/lib/painel/agenda-papel";
import { ROTULO_FUSO } from "@/lib/visitas-video";
import { AgendaClient } from "./agenda-client";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Ferramentas › Agenda (prompt 23): visitas, entradas, saídas e datas bloqueadas de todos os imóveis. */
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ imovel?: string }> }) {
  const papeisLidos = estadoDosPapeis().catch(() => null);
  const { itens, imoveis } = await carregarAgendaDoDono({ exigir: true });
  const papeis = await papeisLidos;
  // AGENDA-A: "Ver na Agenda" da edição do imóvel abre a Agenda já filtrada nele.
  const { imovel } = await searchParams;
  // E410 (01/11): a Agenda é página comum (não troca o papel). No painel da MORADORA ela dizia "todos os seus imóveis" e
  // "Quando você anunciar… / Anunciar imóvel" — textos do proprietário. No papel morador, o texto é o dela.
  const morador = agendaNoPapelMorador(papeis);
  if (morador && imoveis.length === 0) {
    return (
      <>
        <PageTitle title="Agenda" subtitle={TEXTOS_AGENDA_MORADOR.subtitulo(ROTULO_FUSO)} />
        <div data-testid="agenda-morador">
          <EmptyState
            icon={CalendarDays}
            title={TEXTOS_AGENDA_MORADOR.vazioTitulo}
            text={TEXTOS_AGENDA_MORADOR.vazioTexto}
            action={
              <ButtonLink href="/dashboard/visitas" variant="primary">
                {TEXTOS_AGENDA_MORADOR.acao}
              </ButtonLink>
            }
          />
        </div>
      </>
    );
  }
  return (
    <>
      <PageTitle
        title="Agenda"
        subtitle={morador ? TEXTOS_AGENDA_MORADOR.subtituloComImoveis(ROTULO_FUSO) : `Visitas, entradas, saídas e datas bloqueadas de todos os seus imóveis (${ROTULO_FUSO}).`}
      />
      {morador && (
        <p className="-mt-2 mb-4 text-sm text-muted" data-testid="agenda-morador-visitas">
          {TEXTOS_AGENDA_MORADOR.lembrete}{" "}
          <Link href="/dashboard/visitas" className="alvo-toque font-medium text-forest underline">
            {TEXTOS_AGENDA_MORADOR.acao}
          </Link>
        </p>
      )}
      {imoveis.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum imóvel ainda"
          text="Quando você anunciar, as visitas e as estadias de todos os imóveis aparecem aqui num calendário só."
          action={
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary">
              Anunciar imóvel
            </ButtonLink>
          }
        />
      ) : (
        <AgendaClient itens={itens} imoveis={imoveis} hojeISO={new Date().toISOString()} imovelInicial={typeof imovel === "string" ? imovel : ""} />
      )}
    </>
  );
}
