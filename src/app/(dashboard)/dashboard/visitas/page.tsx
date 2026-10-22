import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ValorDiretoAoProprietario } from "@/components/contexto/cabecalho-contexto";
import { ButtonLink } from "@/components/ui/button";
import { CartaoVisita } from "@/components/visitas/cartao-visita";
import { listMinhasVisitas, listVisitasDono } from "@/lib/data/visitas-video-actions";
import { ROTULO_FUSO } from "@/lib/visitas-video";

export const metadata: Metadata = {
  title: "Visitas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Visitas (prompt 23): por vídeo e PRESENCIAIS, no mesmo lugar e no mesmo fluxo — pedida, confirmada, remarcar,
 * cancelada —, sempre no horário de Brasília. Nada de WhatsApp nem contato direto.
 */
export default async function VisitasPage() {
  const [recebidos, meus] = await Promise.all([listVisitasDono(), listMinhasVisitas()]);
  const vazio = recebidos.length === 0 && meus.length === 0;
  return (
    <>
      <PageTitle
        title="Visitas"
        subtitle={`Por vídeo ou presenciais, combinadas aqui na plataforma (${ROTULO_FUSO}). Nome e contato do interessado só aparecem depois do aceite.`}
      />
      <ValorDiretoAoProprietario className="-mt-2 mb-4 text-sm text-muted" />
      {vazio ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nenhuma visita ainda"
          text="Na página de um imóvel, toque em “Agendar visita” ou “Visita por vídeo”, escolha até 3 horários e acompanhe a resposta aqui."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-6">
          {recebidos.length > 0 && (
            <section aria-labelledby="visitas-recebidas" data-testid="visitas-recebidas">
              <h2 id="visitas-recebidas" className="mb-3 font-title text-lg font-semibold text-ink">
                Pedidos nos meus imóveis
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {recebidos.map((v) => (
                  <Panel key={v.id}>
                    <CartaoVisita v={v} papel="dono" />
                  </Panel>
                ))}
              </div>
            </section>
          )}
          {meus.length > 0 && (
            <section aria-labelledby="visitas-minhas" data-testid="visitas-minhas">
              <h2 id="visitas-minhas" className="mb-3 font-title text-lg font-semibold text-ink">
                Meus pedidos
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {meus.map((v) => (
                  <Panel key={v.id}>
                    <CartaoVisita v={v} papel="morador" />
                  </Panel>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
