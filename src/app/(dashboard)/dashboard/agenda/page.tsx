import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { carregarAgendaDoDono } from "@/lib/data/agenda-servidor";
import { ROTULO_FUSO } from "@/lib/visitas-video";
import { AgendaClient } from "./agenda-client";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Ferramentas › Agenda (prompt 23): visitas, entradas, saídas e datas bloqueadas de todos os imóveis. */
export default async function AgendaPage() {
  const { itens, imoveis } = await carregarAgendaDoDono();
  return (
    <>
      <PageTitle title="Agenda" subtitle={`Visitas, entradas, saídas e datas bloqueadas de todos os seus imóveis (${ROTULO_FUSO}).`} />
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
        <AgendaClient itens={itens} imoveis={imoveis} hojeISO={new Date().toISOString()} />
      )}
    </>
  );
}
