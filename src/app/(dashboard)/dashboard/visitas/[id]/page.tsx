import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { VoltarLista } from "@/components/ui/voltar-lista";
import { CartaoVisita } from "@/components/visitas/cartao-visita";
import { visitaDetalhe } from "@/lib/data/visitas-video-actions";
import { MODALIDADE_ROTULO, ROTULO_FUSO } from "@/lib/visitas-video";
import { HREF_VISITAS_DONO } from "@/lib/painel/decisoes";

export const metadata: Metadata = {
  title: "Visita",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * E211: o detalhe de UMA visita, aberto pela Agenda, pela lista de visitas e pelo cartão da conversa — para o dono e
 * para o morador daquela visita (outra pessoa: 404). Status, data e horário (Brasília), imóvel, tipo, quem vem (para o
 * dono, o 1º nome só depois do aceite), o endereço exato da presencial pela regra de endereco-visita.ts (confirmada e
 * até 3 h depois do horário; fora disso, só a região), "Entrar na chamada" só enquanto a visita não passou e as
 * mesmas ações do cartão ("Marcar como feita" etc.).
 */
export default async function VisitaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await visitaDetalhe(id);
  if (!v) notFound();
  const dono = v.papel === "dono";
  return (
    <div data-testid="visita-detalhe" data-papel={v.papel}>
      <VoltarLista href={dono ? HREF_VISITAS_DONO : "/dashboard/visitas"} rotulo={dono ? "Visitas nos meus imóveis" : "Visitas"} />
      <PageTitle title={`Visita ${MODALIDADE_ROTULO[v.modalidade].toLowerCase()} · ${v.imovel}`} subtitle={`Horários em ${ROTULO_FUSO}.`} />
      <Panel className="max-w-2xl">
        <CartaoVisita v={v} papel={dono ? "dono" : "morador"} />
      </Panel>
    </div>
  );
}
