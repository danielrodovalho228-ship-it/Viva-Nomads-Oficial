import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { catalogoServicosMorador, meusPedidosServico, moradorTemContratoAtivo } from "@/lib/data/servicos-morador-actions";
import { NOTA_PAGAMENTO_DIRETO } from "@/lib/servicos-morador";
import { CatalogoServicos } from "./catalogo-servicos";
import { PedidosServico } from "./pedidos-servico";

export const metadata: Metadata = {
  title: "Serviços",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Serviços para o morador (ordem 521c5af7, S1–S3): catálogo, pedido e acompanhamento.
 * A Viva não recebe nem repassa dinheiro: o morador paga direto ao prestador parceiro.
 */
export default async function ServicosPage() {
  const [ativo, catalogo, pedidos] = await Promise.all([
    moradorTemContratoAtivo(),
    catalogoServicosMorador(),
    meusPedidosServico(),
  ]);
  if (!ativo) {
    return (
      <>
        <PageTitle title="Serviços" subtitle={NOTA_PAGAMENTO_DIRETO} />
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
      <PageTitle title="Serviços" subtitle={NOTA_PAGAMENTO_DIRETO} />
      <div className="grid gap-6">
        <section aria-labelledby="servicos-catalogo" data-testid="servicos-catalogo">
          <h2 id="servicos-catalogo" className="mb-3 font-title text-lg font-bold text-ink">
            Serviços disponíveis
          </h2>
          <CatalogoServicos servicos={catalogo} />
        </section>
        <Panel title="Meus pedidos" data-testid="servicos-pedidos">
          <PedidosServico pedidos={pedidos} />
        </Panel>
      </div>
    </>
  );
}
