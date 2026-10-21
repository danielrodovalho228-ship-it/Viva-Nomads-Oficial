import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ServicosPainel } from "@/components/parceiros/servicos-painel";
import { cidadeDosMeusServicos, meusPedidosDeServico } from "@/lib/parceiros/pedido-actions";
import { proximoPasso, rotuloStatus } from "@/lib/parceiros/pedido";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { MEUS_PEDIDOS_VAZIO, notaPagamentoServicos } from "@/lib/servicos-morador";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { dataHoraBRT } from "@/lib/datas-brasilia";

export const metadata: Metadata = {
  title: "Serviços",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Serviços (Prompt 31b, item 7): a porta dos parceiros nos painéis do morador e do dono — categorias → parceiros
 * publicados na cidade → página do parceiro → "Solicitar orçamento" — e "Meus pedidos" com o estado e o próximo passo.
 * O catálogo antigo do morador ficou obsoleto: esta tela não lê mais dele.
 */
export default async function ServicosPage() {
  const [cidade, pedidos] = await Promise.all([cidadeDosMeusServicos(), meusPedidosDeServico()]);
  return (
    <>
      <PageTitle title="Serviços" subtitle={notaPagamentoServicos(PAGAMENTO_PARCEIROS_ATIVO)} />
      <ServicosPainel cidade={cidade} />
      <Panel title="Meus pedidos" className="mt-6" data-testid="servicos-pedidos">
        {pedidos.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum pedido ainda" text={MEUS_PEDIDOS_VAZIO} />
        ) : (
          <ul className="divide-y divide-line" data-testid="servicos-pedidos-lista">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/servicos/pedidos/${p.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3" data-testid="servicos-pedido">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {rotuloCategoria(p.categoria)} · {p.outroLado}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.codigo}
                      {p.valor != null ? ` · ${brl(p.valor)}` : ""}
                      {p.horario ? ` · ${dataHoraBRT(p.horario)}` : ""}
                    </span>
                    {proximoPasso(p.status, "cliente") && <span className="block text-xs text-muted">{proximoPasso(p.status, "cliente")}</span>}
                  </span>
                  <span className="text-sm font-semibold text-ink" data-testid="servicos-pedido-status">
                    {rotuloStatus(p.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
