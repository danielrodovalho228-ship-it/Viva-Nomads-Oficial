import Link from "next/link";
import { CheckCircle2, ClipboardList, CreditCard, Handshake, Inbox, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { SeloTeste } from "@/components/admin/selo-teste";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { FORMULAS_PEDIDOS_PARCEIRO, numerosPedidosParceiro, rotuloStatus, type PedidoParaNumeros } from "@/lib/parceiros/pedido";

export const metadata = { title: "Pedidos de parceiros — Admin" };
export const dynamic = "force-dynamic";

const brl = (n: number | string | null) => (n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/**
 * Admin → Parceiros → Pedidos (Prompt 31b, item 9): lista com estado, valores, taxa, origem e ref do cartão, e os
 * números com a fórmula escrita (contas de teste fora). O layout de /admin exige admin.
 */
export default async function AdminPedidosParceirosPage() {
  const admin = createAdminClient();
  if (!admin) return <EmptyState icon={ClipboardList} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />;
  const [{ data }, testes, { data: parcs }] = await Promise.all([
    admin
      .from("parceiro_pedidos")
      .select("id, codigo, status, categoria, cliente_id, parceiro_id, valor_combinado, valor_taxa, valor_parceiro, pagamento_status, origem, ref_tipo, ref_codigo, criado_em")
      .order("criado_em", { ascending: false })
      .limit(1000),
    idsContasTeste(admin),
    admin.from("parceiros").select("id, user_id, nome_publico").limit(5000),
  ]);
  const pedidos = (data ?? []) as (PedidoParaNumeros & { id: string; codigo: string; categoria: string; valor_combinado: number | string | null; valor_parceiro: number | string | null; origem: string; ref_codigo: string | null; criado_em: string })[];
  const parceiros = (parcs ?? []) as { id: string; user_id: string; nome_publico: string }[];
  const dono = new Map(parceiros.map((p) => [p.id, p.user_id]));
  const nome = new Map(parceiros.map((p) => [p.id, p.nome_publico]));
  const n = numerosPedidosParceiro(pedidos, testes, dono);
  const ehTeste = (p: { cliente_id: string; parceiro_id: string }) => testes.has(p.cliente_id) || testes.has(dono.get(p.parceiro_id) ?? "");

  return (
    <>
      <PageTitle title="Pedidos de parceiros" subtitle="Orçamentos, aceites e entregas. A Viva só conecta: nenhum dinheiro passa por aqui." />
      <p className="mb-4 text-sm">
        <Link href="/admin/parceiros" className="text-blue-700 underline underline-offset-2">
          Voltar para Parceiros
        </Link>
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="admin-pedidos-numeros">
        <StatCard label="Pedidos" icon={ClipboardList} value={String(n.total)} hint={FORMULAS_PEDIDOS_PARCEIRO.total} />
        <StatCard label="Abertos" icon={Inbox} value={String(n.abertos)} hint={FORMULAS_PEDIDOS_PARCEIRO.abertos} />
        <StatCard label="Fechados" icon={Handshake} value={`${n.fechados} (${n.conversao}%)`} hint={`${FORMULAS_PEDIDOS_PARCEIRO.fechados} ${FORMULAS_PEDIDOS_PARCEIRO.conversao}`} />
        <StatCard label="Concluídos" icon={CheckCircle2} value={String(n.concluidos)} hint={FORMULAS_PEDIDOS_PARCEIRO.concluidos} />
        <StatCard label="Taxa registrada" icon={Receipt} value={brl(n.taxaRegistrada)} hint={FORMULAS_PEDIDOS_PARCEIRO.taxaRegistrada} />
        <div data-testid="admin-pedidos-de-cartao" data-valor={n.vindosDeCartao}>
          <StatCard label="Pedidos vindos de cartão" icon={CreditCard} value={String(n.vindosDeCartao)} hint={FORMULAS_PEDIDOS_PARCEIRO.vindosDeCartao} />
        </div>
      </div>
      <Panel title="Todos os pedidos" className="mt-6">
        {pedidos.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum pedido ainda" text="Os pedidos de orçamento aparecem aqui assim que alguém pedir." />
        ) : (
          <ul className="divide-y divide-line" data-testid="admin-pedidos-lista">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/parceiros/pedidos/${p.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm" data-testid="admin-pedido">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {p.codigo} · {rotuloCategoria(p.categoria)} · {nome.get(p.parceiro_id) ?? "Parceiro"} {ehTeste(p) && <SeloTeste />}
                    </span>
                    <span className="block text-xs text-muted">
                      {dataHoraBRT(p.criado_em)} · origem {p.origem}
                      {p.ref_tipo ? ` · cartão ${p.ref_codigo}` : ""} · pagamento {p.pagamento_status}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-ink">{rotuloStatus(p.status)}</span>
                    <span className="block text-xs text-muted">
                      {brl(p.valor_combinado)} · taxa {brl(p.valor_taxa)} · parceiro {brl(p.valor_parceiro)}
                    </span>
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
