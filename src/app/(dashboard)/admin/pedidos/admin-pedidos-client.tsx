"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw, Megaphone, Sparkles, Mail, MessageSquare, Clock } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import type { MetricasPedidos } from "@/lib/data/pedidos-compat";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { motivoLabel, PEDIDO_STATUS_LABEL } from "@/lib/pedidos/pedidos";
import { moderarPedido, reativarPedido } from "@/lib/data/pedidos-admin";
import { MotivoDialog } from "@/components/admin/motivo-dialog";

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

export function AdminPedidosClient({
  pedidos,
  metricas,
}: {
  pedidos: Record<string, unknown>[];
  metricas: MetricasPedidos | null;
}) {
  const router = useRouter();
  const lista = pedidos as unknown as Pedido[];
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [ocultando, setOcultando] = useState<Pedido | null>(null);

  async function ocultar(motivo: string): Promise<string | null> {
    if (!ocultando) return null;
    const res = await moderarPedido(ocultando.id, motivo);
    if (!res.ok) return res.error ?? "Não foi possível ocultar.";
    setOcultando(null);
    router.refresh();
    return null;
  }
  async function reativar(id: string) {
    setBusy(id);
    setErro((e) => ({ ...e, [id]: "" }));
    const res = await reativarPedido(id);
    setBusy(null);
    if (!res.ok) setErro((e) => ({ ...e, [id]: res.error ?? "Não foi possível reativar." }));
    router.refresh();
  }

  return (
    <>
      <PageTitle
        title="Moderação de pedidos"
        subtitle="Ocultar pedidos impróprios (com motivo, notificando o inquilino) e reativar."
      />
      <MetricasPedidosPainel m={metricas} />
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
                            onClick={() => setOcultando(p)}
                            disabled={busy === p.id}
                          >
                            <EyeOff className="h-4 w-4" /> Ocultar
                          </Button>
                        )}
                      </div>
                      {erro[p.id] && (
                        <p role="alert" className="mt-1 text-right text-xs text-red-600">
                          {erro[p.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <MotivoDialog
        // key: cada abertura começa limpa (sem o motivo de uma tentativa anterior).
        key={ocultando?.id ?? "fechado"}
        open={!!ocultando}
        titulo="Ocultar pedido"
        descricao={
          ocultando
            ? `${motivoLabel(ocultando.motivo)} · ${ocultando.cidade}. O motivo fica registrado e vai ao inquilino.`
            : undefined
        }
        confirmar="Ocultar"
        onCancel={() => setOcultando(null)}
        onConfirm={ocultar}
      />
    </>
  );
}

/** Números do funil de pedidos (últimos 30 dias). "—" quando não há dado. */
function MetricasPedidosPainel({ m }: { m: MetricasPedidos | null }) {
  const pct =
    m && m.pedidos > 0 ? `${Math.round((m.pedidos_com_compativel / m.pedidos) * 100)}%` : "—";
  const taxa =
    m && m.avisos_email + m.avisos_resumo > 0
      ? `${Math.round((m.avisos_respondidos / (m.avisos_email + m.avisos_resumo)) * 100)}%`
      : "—";
  const horas =
    m?.horas_media_resposta == null ? "—" : `${String(m.horas_media_resposta).replace(".", ",")} h`;
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm text-muted">Últimos 30 dias</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        <StatCard label="Pedidos" value={m?.pedidos ?? "—"} icon={Megaphone} />
        <StatCard label="Com compatível ao publicar" value={pct} icon={Sparkles} />
        <StatCard label="Avisos enviados" value={m ? m.avisos_email + m.avisos_resumo : "—"} icon={Mail} />
        <StatCard label="Taxa de resposta" value={taxa} icon={MessageSquare} />
        <StatCard label="Tempo médio de resposta" value={horas} icon={Clock} />
      </div>
    </div>
  );
}
