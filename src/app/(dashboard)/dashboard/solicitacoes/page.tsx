"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Clock, CheckCircle2, Wrench } from "lucide-react";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ResponsiveOwnerBadge } from "@/components/ui/badge";
import { ServiceOrderNotice } from "@/components/legal-notice";
import { useViewMode } from "@/lib/roles";
import { useDashDemo, useDisplayUser } from "@/lib/demo/demo-mode";
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
import { avancarSolicitacao, minhasSolicitacoes, type ContratoManutencao } from "@/lib/data/manutencao-actions";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { PRAZO_MANUTENCAO_H } from "@/config/atendimento";
import { MSG_SEM_CONTRATO_MANUTENCAO } from "@/lib/manutencao-solicitacoes";

export default function ServiceOrdersPage() {
  // Modo real: começa sem chamados fictícios; demonstração (build sem Supabase
  // OU modo demo do admin): mostra exemplos. `key` remonta o inner ao alternar,
  // para o estado nascer da fonte certa — sem misturar real e fictício.
  const demo = useDashDemo();
  return <ServiceOrdersInner key={demo ? "demo" : "real"} demo={demo} />;
}

function ServiceOrdersInner({ demo }: { demo: boolean }) {
  // A tela aparece nos dois menus; a visão segue o MODO ativo (não o papel de
  // cadastro), para o conteúdo bater com o contexto em que o usuário está.
  const { mode } = useViewMode();
  const displayUser = useDisplayUser();
  // Demonstração: exemplos em memória. Real: LÊ e GRAVA no banco (service_orders
  // ligado ao contrato) — recarregar a página não perde nada (F28).
  const [orders, setOrders] = useState<ServiceOrder[]>(demo ? SAMPLE_ORDERS : []);
  const [contratos, setContratos] = useState<ContratoManutencao[]>([]);
  const [carregando, setCarregando] = useState(!demo);
  const [falhou, setFalhou] = useState(false);

  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (demo) return;
    let vivo = true;
    minhasSolicitacoes()
      .then((r) => {
        if (!vivo) return;
        setOrders(r ? (mode === "tenant" ? r.comoInquilino : r.comoDono) : []);
        setContratos(r?.contratos ?? []);
        setFalhou(false);
      })
      .catch(() => vivo && setFalhou(true))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [demo, mode, tentativa]);
  const carregar = async () => {
    setCarregando(true);
    setTentativa((n) => n + 1);
  };

  // Identidade do inquilino nos chamados: no demo é a persona dos exemplos (para
  // casar com SAMPLE_ORDERS); no real é o nome do próprio usuário — nunca um nome
  // fictício estampado no chamado de conta real.
  const tenantName = demo
    ? "Ana Carvalho" // consistency-ignore: persona de demonstração, ramo demo apenas
    : displayUser?.fullName?.trim() || displayUser?.name?.trim() || "";

  if (carregando) return <p className="text-sm text-muted">Carregando solicitações…</p>;
  if (falhou)
    return (
      <Panel className="text-sm text-muted">
        Não foi possível carregar as solicitações agora.{" "}
        <button type="button" className="font-medium text-forest underline" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </Panel>
    );
  if (mode === "tenant")
    return <TenantView demo={demo} orders={orders} setOrders={setOrders} tenantName={tenantName} contratos={contratos} recarregar={carregar} />;
  return <OwnerView demo={demo} orders={orders} setOrders={setOrders} />;
}

/* ───────── PROPRIETÁRIO ───────── */
function OwnerView({
  demo,
  orders,
  setOrders,
}: {
  demo: boolean;
  orders: ServiceOrder[];
  setOrders: (o: ServiceOrder[]) => void;
}) {
  const sorted = useMemo(() => sortByPriority(orders), [orders]);
  const metrics = useMemo(() => ownerMetrics(orders), [orders]);
  const openCount = orders.filter((o) => o.status !== "resolvido").length;

  const [erro, setErro] = useState<string | null>(null);

  async function advance(id: string) {
    if (!demo) {
      setErro(null);
      const r = await avancarSolicitacao(id).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
      if (!r.ok) return setErro(r.error);
      setOrders(orders.map((o) => (o.id === id ? { ...r.ordem, tenantName: o.tenantName } : o)));
      return;
    }
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
          value={metrics.respondedCount ? `${metrics.avgFirstResponseH.toFixed(0)}h` : "—"}
          icon={Clock}
        />
        <StatCard
          label="Resolução média"
          value={metrics.resolvedCount ? `${metrics.avgResolutionH.toFixed(0)}h` : "—"}
          icon={CheckCircle2}
        />
      </div>

      {erro && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {erro}
        </p>
      )}
      {sorted.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhuma solicitação ainda"
          text="Quando um inquilino abrir um chamado de manutenção em um dos seus imóveis, ele aparece aqui — ordenado por prioridade."
        />
      ) : (
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
      )}

      <ServiceOrderNotice className="mt-4" />
    </>
  );
}

/* ───────── INQUILINO ───────── */
function TenantView({
  demo,
  orders,
  setOrders,
  tenantName,
  contratos,
  recarregar,
}: {
  demo: boolean;
  orders: ServiceOrder[];
  setOrders: (o: ServiceOrder[]) => void;
  tenantName: string;
  contratos: ContratoManutencao[];
  recarregar: () => Promise<void>;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [category, setCategory] = useState<SOCategory>("hidraulica");
  const [priority, setPriority] = useState<SOPriority>("media");
  const [description, setDescription] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Real: o servidor já devolve só os chamados da pessoa; demo filtra pelo nome do exemplo.
  const mine = demo ? orders.filter((o) => o.tenantName === tenantName) : orders;
  // Real: manutenção só a partir de um contrato ativo (F27).
  const semContrato = !demo && contratos.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    if (!demo) {
      const alvo = contratoId || (contratos.length === 1 ? contratos[0].id : "");
      if (!alvo) return setErro("Escolha o imóvel do contrato.");
      setErro(null);
      setEnviando(true);
      const r = await abrirChamado({
        categoria: "manutencao",
        mensagem: description,
        canal: "site",
        contratoId: alvo,
        urgencia: priority,
        categoriaManutencao: category,
      }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
      setEnviando(false);
      if (!r.ok) return setErro(r.error);
      setAviso(r.aviso);
      setDescription("");
      setOpenForm(false);
      await recarregar();
      return;
    }
    const novo: ServiceOrder = {
      id: `so-${Date.now()}`,
      property: "Apto Santa Mônica",
      tenantName,
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
          <Button variant="accent" disabled={semContrato} onClick={() => setOpenForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Abrir solicitação
          </Button>
        }
      />

      {semContrato && (
        <Panel className="mb-6" data-testid="manutencao-sem-contrato">
          <p className="text-sm text-ink">{MSG_SEM_CONTRATO_MANUTENCAO}</p>
          <Link href="/ajuda" className="mt-3 inline-block text-sm font-medium text-forest underline">
            Ir para a Central de Ajuda
          </Link>
        </Panel>
      )}
      {aviso && (
        <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {aviso}
        </p>
      )}

      {openForm && !semContrato && (
        <Panel className="mb-6">
          <form onSubmit={submit} className="space-y-4">
            {!demo && contratos.length > 1 && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Imóvel</span>
                <select
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                  className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
                  required
                >
                  <option value="">Escolha o imóvel</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
            {erro && (
              <p role="alert" className="text-sm text-red-600">
                {erro}
              </p>
            )}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar solicitação"}
            </Button>
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
              <button
                type="button"
                onClick={() => setAberta(aberta === o.id ? null : o.id)}
                aria-expanded={aberta === o.id}
                data-testid="solicitacao-cartao"
                className="flex w-full items-start justify-between gap-3 text-left"
              >
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
              </button>
              {aberta === o.id && (
                <dl className="mt-3 grid gap-1 border-t border-sage-100 pt-3 text-sm text-muted" data-testid="solicitacao-detalhe">
                  <div>
                    <dt className="inline font-medium text-ink">Imóvel: </dt>
                    <dd className="inline">{o.property}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-ink">Status: </dt>
                    <dd className="inline">{SO_STATUS_META[o.status].label}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-ink">Prazo do proprietário: </dt>
                    <dd className="inline">{PRAZO_MANUTENCAO_H[o.priority]} h para responder</dd>
                  </div>
                  {o.firstResponseAt && (
                    <div>
                      <dt className="inline font-medium text-ink">Primeira resposta: </dt>
                      <dd className="inline">{timeAgo(o.firstResponseAt)}</dd>
                    </div>
                  )}
                </dl>
              )}
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
