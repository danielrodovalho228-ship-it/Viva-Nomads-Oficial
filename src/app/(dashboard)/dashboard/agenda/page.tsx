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

/** Anúncios › Agenda (prompt 23; AGENDA-A): estadias, visitas e datas bloqueadas, com bloquear e sincronizar no mesmo lugar. */
export default async function AgendaPage() {
  const { itens, imoveis } = await carregarAgendaDoDono();
  return (
    <>
      <PageTitle title="Agenda" subtitle={`Estadias, visitas e datas bloqueadas dos seus imóveis (${ROTULO_FUSO}).`} />
      {imoveis.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum imóvel ainda"
          text="Cadastre um imóvel para ver aqui as estadias, as visitas e as datas bloqueadas num calendário só."
          action={
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary" data-testid="agenda-cadastrar-imovel">
              Cadastrar imóvel
            </ButtonLink>
          }
        />
      ) : (
        <AgendaClient itens={itens} imoveis={imoveis} hojeISO={new Date().toISOString()} />
      )}
    </>
  );
}
