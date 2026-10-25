import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { AVISO_OCUPANTES } from "@/lib/estadia/ocupantes";
import { OcupantesTela } from "./ocupantes-tela";

export const metadata: Metadata = { title: "Ocupantes da estadia", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ocupantes (Prompt 32, item 3): o morador preenche depois da assinatura; o dono vê e baixa a lista da portaria. */
export default async function OcupantesPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  return (
    <div className="space-y-4" data-testid="pagina-ocupantes">
      <PageTitle title="Ocupantes" subtitle={`${e.imovel.titulo} · Contrato ${e.numero}`} />
      <Panel>
        <p className="text-sm text-ink" data-testid="ocupantes-aviso">{AVISO_OCUPANTES}</p>
        <p className="mt-1 text-sm text-muted">
          Este contrato prevê {e.ocupantesPrevistos} {e.ocupantesPrevistos === 1 ? "ocupante" : "ocupantes"}. Os dados são apagados 90 dias depois do fim do contrato.
        </p>
      </Panel>
      <OcupantesTela
        contratoId={e.id}
        ocupantes={e.ocupantes}
        previstos={e.ocupantesPrevistos}
        podeEditar={e.podeEditarOcupantes}
        motivoBloqueio={e.papel === "proprietario" ? "Quem preenche é o morador. Você vê a lista e baixa para a portaria." : !e.assinadoPelasDuas ? "Os ocupantes são preenchidos depois da assinatura das duas partes." : null}
      />
      <ButtonLink href={HREF_ESTADIA(e.id)} variant="tertiary" size="sm">
        Voltar para a estadia
      </ButtonLink>
    </div>
  );
}
