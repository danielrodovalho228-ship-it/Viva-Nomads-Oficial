import type { Metadata } from "next";
import { Clock, XCircle } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { SejaParceiroForm } from "@/components/parceiros/seja-parceiro-form";
import { minhaParceria } from "@/lib/parceiros/solicitacao-actions";
import { meuPainelParceiro } from "@/lib/parceiros/painel-actions";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { PainelParceiroCliente } from "./painel-parceiro";
import { PedidosDoParceiro } from "@/components/parceiros/pedidos-do-parceiro";

export const metadata: Metadata = { title: "Parceiro", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Painel do parceiro (Prompt 31a, item 5). Sem a página ainda: o pedido (ou o formulário, pré-preenchido pela conta).
 * Com a página: Dados, Página, Serviços e Atendimento, e Publicar/Pausar.
 */
export default async function ParceiroPainelPage({ searchParams }: { searchParams: Promise<{ ativada?: string }> }) {
  const sp = await searchParams;
  const painel = await meuPainelParceiro();
  if (painel) {
    return (
      <>
        <PageTitle title="Parceiro" subtitle="A sua página de parceiro na Viva: dados, página, serviços e atendimento." />
        {sp.ativada === "1" && (
          <p className="mb-4 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-ink" role="status" data-testid="parceiro-ativada">
            Parceria ativada. Complete a página e publique quando estiver pronta.
          </p>
        )}
        {/* Prompt 31b: pedidos (novos primeiro) e ganhos com a divisão 90/10. */}
        <PedidosDoParceiro pagamentoAtivo={PAGAMENTO_PARCEIROS_ATIVO} />
        <PainelParceiroCliente inicial={painel} pagamentoAtivo={PAGAMENTO_PARCEIROS_ATIVO} />
      </>
    );
  }
  const estado = await minhaParceria();
  const sol = estado.solicitacao;
  return (
    <>
      <PageTitle title="Quero ser parceiro" subtitle="Peça a parceria com esta conta. A Viva analisa e responde por e-mail." />
      {sol?.status === "aprovada" ? (
        <Panel data-testid="parceiro-aprovado">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Clock className="h-5 w-5 text-forest" aria-hidden /> Sua parceria foi aprovada.
          </p>
          <p className="mt-1 text-sm text-muted">Abra o e-mail &quot;Sua parceria foi aprovada&quot; e use o botão para ativar a sua página.</p>
        </Panel>
      ) : (
        <Panel>
          {sol?.status === "recusada" && (
            <p className="mb-4 flex gap-2 text-sm text-ink" data-testid="parceiro-recusado">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden /> O último pedido não foi aprovado. A sua conta continua normal para alugar ou anunciar.
            </p>
          )}
          <SejaParceiroForm estado={estado} origem="conta" />
        </Panel>
      )}
    </>
  );
}
