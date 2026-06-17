"use client";

import { useMemo, useState } from "react";
import { Plus, Upload, Clock, CheckCircle2, Wrench } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ResponsiveOwnerBadge } from "@/components/ui/badge";
import { ServiceOrderNotice } from "@/components/legal-notice";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import {
  SAMPLE_ORDERS,
  SO_CATEGORIES,
  SO_PRIORITY_META,
  SO_STATUS_META,
  categoryLabel,
  nextStatus,
  sortByPriority,
  ownerMetrics,
  type ServiceOrder,
  type SOCategory,
  type SOPriority,
} from "@/lib/service-orders";
import { cn } from "@/lib/utils";

export default function ServiceOrdersPage() {
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;
  const [orders, setOrders] = useState<ServiceOrder[]>(SAMPLE_ORDERS);

  if (user.role === "tenant") return <TenantView orders={orders} setOrders={setOrders} />;
  return <OwnerView orders={orders} setOrders={setOrders} />;
}

/* ───────── PROPRIETÁRIO ───────── */
function OwnerView({
  orders,
  setOrders,
}: {
  orders: ServiceOrder[];
  setOrders: (o: ServiceOrder[]) => void;
}) {
  const sorted = useMemo(() => sortByPriority(orders), [orders]);
  const metrics = useMemo(() => ownerMetrics(orders), [orders]);
  const openCount = orders.filter((o) => o.status !== "resolvido").length;

  function advance(id: string) {
    setOrders(
      orders.map((o) => {
        if (o.id !== id) return o;
        const ns = nextStatus(o.status);
        if (!ns) return o;
        const now = new Date().toISOString();
        return {
          ...o,
          status: ns,
          firstResponseAt: o.firstResponseAt ?? now,
          resolvedAt: ns === "resolvido" ? now : o.resolvedAt,
        };
      })
    );
  }

  return (
    <>
      <PageTitle
        title="Solicitações de manutenção"
        subtitle="Chamados dos seus imóveis, por prioridade."
        action={metrics.responsive ? <ResponsiveOwnerBadge /> : undefined}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Em aberto" value={openCount} icon={Wrench} />
        <StatCard
          label="Resposta média"
          value={`${metrics.avgFirstResponseH.toFixed(0)}h`}
          icon={Clock}
        />
        <StatCard
          label="Resolução média"
          value={`${metrics.avgResolutionH.toFixed(0)}h`}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-3">
        {sorted.map((o) => {
          const ns = nextStatus(o.status);
          return (
            <Panel key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        SO_PRIORITY_META[o.priority].tone
                      )}
                    >
                      {SO_PRIORITY_META[o.priority].label}
                    </span>
                    <span className="text-sm font-medium text-ink">{categoryLabel(o.category)}</span>
                    <span className="text-sm text-muted">· {o.property}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{o.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {o.tenantName} · aberto {timeAgo(o.openedAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      SO_STATUS_META[o.status].tone
                    )}
                  >
                    {SO_STATUS_META[o.status].label}
                  </span>
                  {ns && (
                    <Button size="sm" variant="outline" onClick={() => advance(o.id)}>
                      Marcar como {SO_STATUS_META[ns].label}
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <ServiceOrderNotice className="mt-4" />
    </>
  );
}

/* ───────── INQUILINO ───────── */
function TenantView({
  orders,
  setOrders,
}: {
  orders: ServiceOrder[];
  setOrders: (o: ServiceOrder[]) => void;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [category, setCategory] = useState<SOCategory>("hidraulica");
  const [priority, setPriority] = useState<SOPriority>("media");
  const [description, setDescription] = useState("");
  const mine = orders.filter((o) => o.tenantName === "Ana Carvalho");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    const novo: ServiceOrder = {
      id: `so-${Date.now()}`,
      property: "Apto Santa Mônica",
      tenantName: "Ana Carvalho",
      category,
      priority,
      description,
      status: "aberto",
      openedAt: new Date().toISOString(),
    };
    setOrders([novo, ...orders]);
    setDescription("");
    setOpenForm(false);
  }

  return (
    <>
      <PageTitle
        title="Minhas solicitações"
        subtitle="Abra e acompanhe chamados de manutenção do seu imóvel."
        action={
          <Button variant="accent" onClick={() => setOpenForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Abrir solicitação
          </Button>
        }
      />

      {openForm && (
        <Panel className="mb-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Categoria</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SOCategory)}
                  className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
                >
                  {SO_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Prioridade</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SOPriority)}
                  className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Descrição</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o problema..."
                className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <Upload className="h-4 w-4 text-blue-500" /> Anexar foto (opcional)
              <input type="file" accept="image/*" className="hidden" />
            </label>
            <Button type="submit">Enviar solicitação</Button>
          </form>
        </Panel>
      )}

      <div className="grid gap-3">
        {mine.length === 0 ? (
          <Panel className="text-center text-sm text-muted">
            Você ainda não abriu nenhuma solicitação.
          </Panel>
        ) : (
          mine.map((o) => (
            <Panel key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{categoryLabel(o.category)}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        SO_PRIORITY_META[o.priority].tone
                      )}
                    >
                      {SO_PRIORITY_META[o.priority].label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{o.description}</p>
                  <p className="mt-1 text-xs text-muted">aberto {timeAgo(o.openedAt)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    SO_STATUS_META[o.status].tone
                  )}
                >
                  {SO_STATUS_META[o.status].label}
                </span>
              </div>
            </Panel>
          ))
        )}
      </div>

      <ServiceOrderNotice className="mt-4" />
    </>
  );
}

function timeAgo(iso: string) {
  const h = Math.round((Date.now() - +new Date(iso)) / 3600000);
  if (h < 1) return "agora";
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}
