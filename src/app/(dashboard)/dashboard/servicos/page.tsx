import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { catalogoServicosMorador, contratoAtivoDoMorador } from "@/lib/data/servicos-morador-actions";
import { MEUS_PEDIDOS_VAZIO, notaPagamentoServicos } from "@/lib/servicos-morador";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { CatalogoServicos } from "./catalogo-servicos";

export const metadata: Metadata = {
  title: "Serviços",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Serviços para o morador (ordem 521c5af7 + complemento): o catálogo (S1). O pedido e o acompanhamento chegam com as
 * telas do inquilino do Prompt 31b — até lá "Meus pedidos" mostra só o estado vazio, sem formulário.
 */
export default async function ServicosPage() {
  const [contrato, catalogo] = await Promise.all([contratoAtivoDoMorador(), catalogoServicosMorador()]);
  const ativo = !!contrato;
  const nota = notaPagamentoServicos(PAGAMENTO_PARCEIROS_ATIVO);
  if (!ativo) {
    return (
      <>
        <PageTitle title="Serviços" subtitle={nota} />
        <EmptyState
          icon={Wrench}
          title="Os serviços ficam disponíveis na sua locação"
          text="Quando você tiver um contrato ativo, os serviços de parceiros aparecem aqui."
          action={
            <ButtonLink href="/dashboard/contratos" variant="primary">
              Ver meus contratos
            </ButtonLink>
          }
        />
      </>
    );
  }
  return (
    <>
      <PageTitle title="Serviços" subtitle={nota} />
      <div className="grid gap-6">
        <section aria-labelledby="servicos-catalogo" data-testid="servicos-catalogo">
          <h2 id="servicos-catalogo" className="mb-3 font-title text-lg font-bold text-ink">
            Serviços disponíveis
          </h2>
          <CatalogoServicos servicos={catalogo} contratoId={contrato?.contratoId ?? null} propertyId={contrato?.propertyId ?? null} />
        </section>
        <Panel title="Meus pedidos" data-testid="servicos-pedidos">
          <p className="text-sm text-muted" data-testid="servicos-pedidos-vazio">
            {MEUS_PEDIDOS_VAZIO}
          </p>
        </Panel>
      </div>
    </>
  );
}
