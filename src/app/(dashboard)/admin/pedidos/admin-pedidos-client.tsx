"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { motivoLabel, PEDIDO_STATUS_LABEL } from "@/lib/pedidos/pedidos";
import { moderarPedido, reativarPedido } from "@/lib/data/pedidos-admin";

type Pedido = {
  id: string;
  cidade: string;
  uf: string | null;
  motivo: string;
  prazo_meses: number;
  qtd_ocupantes: number;
  orcamento_mensal: number;
  apresentacao: string | null;
  status: string;
  removido_motivo: string | null;
  criado_em: string;
};

const TONE: Record<string, string> = {
  ativo: "bg-green-50 text-green-800",
  pausado: "bg-amber-50 text-amber-800",
  atendido: "bg-blue-50 text-blue-700",
  expirado: "bg-surface-2 text-muted",
  removido_admin: "bg-red-50 text-red-700",
};

export function AdminPedidosClient({ pedidos }: { pedidos: Record<string, unknown>[] }) {
  const router = useRouter();
  const lista = pedidos as unknown as Pedido[];
  const [busy, setBusy] = useState<string | null>(null);

  async function ocultar(id: string) {
    const motivo = window.prompt("Motivo da moderação (será registrado e enviado ao inquilino):");
    if (motivo == null) return;
    setBusy(id);
    const res = await moderarPedido(id, motivo);
    setBusy(null);
    if (!res.ok && res.error) alert(res.error);
    router.refresh();
  }
  async function reativar(id: string) {
    setBusy(id);
    const res = await reativarPedido(id);
    setBusy(null);
    if (!res.ok && res.error) alert(res.error);
    router.refresh();
  }

  return (
    <>
      <PageTitle
        title="Moderação de pedidos"
        subtitle="Ocultar pedidos impróprios (com motivo, notificando o inquilino) e reativar."
      />
      <Panel className="p-0 pt-6">
        <div className="overflow-x-auto px-6 pb-6">
          {lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nenhum pedido no sistema.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">Motivo/Cidade</th>
                  <th className="py-2 font-medium">Detalhes</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {lista.map((p) => (
                  <tr key={p.id} className={cn(p.status === "removido_admin" && "opacity-70")}>
                    <td className="py-3">
                      <p className="font-medium text-ink">{motivoLabel(p.motivo)}</p>
                      <p className="text-xs text-muted">
                        {p.cidade}
                        {p.uf ? `/${p.uf}` : ""}
                      </p>
                    </td>
                    <td className="py-3 text-muted">
                      {p.prazo_meses}m · {p.qtd_ocupantes}p · {formatBRL(p.orcamento_mensal)}/mês
                      {p.apresentacao && (
                        <span className="block max-w-xs truncate text-xs">{p.apresentacao}</span>
                      )}
                      {p.status === "removido_admin" && p.removido_motivo && (
                        <span className="block text-xs text-red-600">
                          Motivo: {p.removido_motivo}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          TONE[p.status] ?? "bg-surface-2 text-muted"
                        )}
                      >
                        {PEDIDO_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        {p.status === "removido_admin" ? (
                          <Button
                            variant="ghost"
                            onClick={() => reativar(p.id)}
                            disabled={busy === p.id}
                          >
                            <RotateCcw className="h-4 w-4" /> Reativar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => ocultar(p.id)}
                            disabled={busy === p.id}
                          >
                            <EyeOff className="h-4 w-4" /> Ocultar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </>
  );
}
