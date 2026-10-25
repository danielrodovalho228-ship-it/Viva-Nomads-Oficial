import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { registrarVistaDoAdmin } from "@/lib/parceiros/pedido-actions";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { rotuloStatus } from "@/lib/parceiros/pedido";

export const metadata = { title: "Pedido de parceiro — Admin" };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (n: number | string | null) => (n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/** Admin → um pedido de parceiro: dados, valores e a linha do tempo dos eventos. Abrir grava "ver_pedido_parceiro". */
export default async function AdminPedidoParceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const admin = createAdminClient();
  if (!admin || !(await registrarVistaDoAdmin(id))) notFound();
  const [{ data: p }, { data: ev }] = await Promise.all([
    admin
      .from("parceiro_pedidos")
      .select("codigo, status, categoria, descricao, valor_combinado, taxa_percent, valor_taxa, valor_parceiro, pagamento_status, pagamento_ref, origem, ref_tipo, ref_codigo, horario_confirmado, criado_em, parceiros(nome_publico)")
      .eq("id", id)
      .maybeSingle(),
    admin.from("parceiro_pedido_eventos").select("tipo, criado_em, dados").eq("pedido_id", id).order("criado_em"),
  ]);
  if (!p) notFound();
  const x = p as unknown as Record<string, string | number | null> & { parceiros: { nome_publico: string } | null };
  return (
    <>
      <PageTitle title={`Pedido ${x.codigo}`} subtitle={`${rotuloCategoria(String(x.categoria))} · ${x.parceiros?.nome_publico ?? "Parceiro"}`} />
      <p className="mb-4 text-sm">
        <Link href="/admin/parceiros/pedidos" className="text-forest underline underline-offset-2">
          Voltar para os pedidos
        </Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Dados" data-testid="admin-pedido-dados">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Estado</dt>
            <dd className="text-ink">{rotuloStatus(String(x.status))}</dd>
            <dt className="text-muted">Valor do serviço</dt>
            <dd className="text-ink">{brl(x.valor_combinado)}</dd>
            <dt className="text-muted">Taxa ({x.taxa_percent != null ? `${Math.round(Number(x.taxa_percent) * 100)}%` : "—"})</dt>
            <dd className="text-ink">{brl(x.valor_taxa)}</dd>
            <dt className="text-muted">Parceiro recebe</dt>
            <dd className="text-ink">{brl(x.valor_parceiro)}</dd>
            <dt className="text-muted">Pagamento</dt>
            <dd className="text-ink">
              {String(x.pagamento_status)}
              {x.pagamento_ref ? ` (${x.pagamento_ref})` : ""}
            </dd>
            <dt className="text-muted">Origem</dt>
            <dd className="text-ink">{String(x.origem)}</dd>
            <dt className="text-muted">Cartão</dt>
            <dd className="text-ink">{x.ref_tipo ? String(x.ref_codigo) : "—"}</dd>
            <dt className="text-muted">Horário</dt>
            <dd className="text-ink">{x.horario_confirmado ? dataHoraBRT(String(x.horario_confirmado)) : "—"}</dd>
            <dt className="text-muted">Criado em</dt>
            <dd className="text-ink">{dataHoraBRT(String(x.criado_em))}</dd>
          </dl>
          {x.descricao && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{String(x.descricao)}</p>}
        </Panel>
        <Panel title="Eventos" data-testid="admin-pedido-eventos">
          <ol className="grid gap-1 text-sm">
            {((ev ?? []) as { tipo: string; criado_em: string }[]).map((e, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-ink">{e.tipo}</span>
                <span className="text-muted">{dataHoraBRT(e.criado_em)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
