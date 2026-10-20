import { notFound } from "next/navigation";
import { CheckCircle2, Inbox } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { pedidosServicoAdmin } from "@/lib/data/servicos-morador-actions";
import { FAIXAS_HORARIO, codigoDoPedido, rotuloEstado } from "@/lib/servicos-morador";
import { MudarEstado } from "./mudar-estado";

export const metadata = { title: "Serviços do morador — Admin" };
export const dynamic = "force-dynamic";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Admin → Serviços do morador (ordem 521c5af7): pedidos dos moradores, com o estado e a mudança de estado. */
export default async function AdminServicosPage() {
  const pedidos = await pedidosServicoAdmin();
  if (pedidos === null) notFound();
  const novos = pedidos.filter((p) => p.status === "enviado").length;
  const andamento = pedidos.filter((p) => p.status === "confirmado").length;
  return (
    <>
      <PageTitle title="Serviços do morador" subtitle="Pedidos feitos pelos moradores. A Viva não recebe nem repassa dinheiro: o pagamento é direto ao prestador." />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Pedidos novos" value={novos} icon={Inbox} />
        <StatCard label="Confirmados" value={andamento} icon={CheckCircle2} />
      </div>
      <Panel>
        {pedidos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <ul className="grid gap-3" data-testid="admin-servicos-lista">
            {pedidos.map((p) => (
              <li key={p.id} className="rounded-xl border border-sage-200 p-3" data-testid="admin-servico-pedido">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {p.servico} · {p.morador}
                  </p>
                  <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">{rotuloEstado(p.status)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {codigoDoPedido(p.id)} · {dataBR(p.dataDesejada)} · {FAIXAS_HORARIO.find((f) => f.id === p.faixa)?.rotulo ?? p.faixa} · {p.prestador}
                </p>
                {p.observacao && <p className="mt-1 text-sm text-ink">{p.observacao}</p>}
                <MudarEstado id={p.id} status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
