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
 * E176 (papel persiste): UM lado por vez. A aba "Visitas" do morador (Pedidos) mostra só as visitas que ele pediu;
 * os pedidos recebidos nos imóveis do dono abrem por `?de=dono` (decisões do Início do dono e o e-mail do pedido).
 */
export default async function VisitasPage({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const dono = (await searchParams).de === "dono";
  const visitas = dono ? await listVisitasDono() : await listMinhasVisitas();
  return (
    <>
      <PageTitle
        title={dono ? "Visitas nos meus imóveis" : "Visitas"}
        subtitle={
          dono
            ? `Por vídeo ou presenciais, combinadas aqui na plataforma (${ROTULO_FUSO}). Nome e contato do interessado só aparecem depois do aceite.`
            : `Por vídeo ou presenciais, combinadas aqui na plataforma (${ROTULO_FUSO}).`
        }
      />
      {dono && <ValorDiretoAoProprietario className="-mt-2 mb-4 text-sm text-muted" />}
      {visitas.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nenhuma visita ainda"
          text={
            dono
              ? "Quando um interessado pedir uma visita a um dos seus imóveis, o pedido aparece aqui para você confirmar um horário."
              : "Na página de um imóvel, toque em “Agendar visita” ou “Visita por vídeo”, escolha até 3 horários e acompanhe a resposta aqui."
          }
          action={
            dono ? undefined : (
              <ButtonLink href="/buscar" variant="primary">
                Explorar imóveis
              </ButtonLink>
            )
          }
        />
      ) : (
        <section aria-label={dono ? "Pedidos nos meus imóveis" : "Meus pedidos de visita"} data-testid={dono ? "visitas-recebidas" : "visitas-minhas"}>
          <div className="grid gap-3 lg:grid-cols-2">
            {visitas.map((v) => (
              <Panel key={v.id}>
                <CartaoVisita v={v} papel={dono ? "dono" : "morador"} hrefDetalhe={`/dashboard/visitas/${v.id}`} />
              </Panel>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
