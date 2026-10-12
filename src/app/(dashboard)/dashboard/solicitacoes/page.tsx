"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Clock, CheckCircle2, Wrench, AlertTriangle } from "lucide-react";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ResponsiveOwnerBadge } from "@/components/ui/badge";
import { ServiceOrderNotice } from "@/components/legal-notice";
import { useViewMode } from "@/lib/roles";
import { useDashDemo, useDisplayUser } from "@/lib/demo/demo-mode";
import {
  SAMPLE_ORDERS,
  SO_CATEGORIES,
  sortByPriority,
  ownerMetrics,
  type ServiceOrder,
  type SOCategory,
  type SOPriority,
} from "@/lib/service-orders";
import { minhasSolicitacoes, type ContratoManutencao } from "@/lib/data/manutencao-actions";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { MSG_SEM_CONTRATO_MANUTENCAO, prazoDaOrdem } from "@/lib/manutencao-solicitacoes";
import { CartaoOrdem, SeletorPrioridade } from "@/components/manutencao/cartao-ordem";

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
  const vencidas = orders.filter((o) => o.status !== "resolvido" && prazoDaOrdem(o, new Date()).estado === "vencido").length;
  const atualizar = (nova: ServiceOrder) => setOrders(orders.map((o) => (o.id === nova.id ? nova : o)));

  return (
    <>
      <PageTitle
        title="Solicitações de manutenção"
        subtitle="Ordens dos seus imóveis, por prioridade, com o prazo para responder."
        action={metrics.responsive ? <ResponsiveOwnerBadge /> : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Em aberto" value={openCount} icon={Wrench} />
        <StatCard label="Fora do prazo" value={vencidas} icon={AlertTriangle} />
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

      {sorted.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhuma solicitação ainda"
          text="Quando um inquilino abrir uma ordem de manutenção em um dos seus imóveis, ela aparece aqui — por prioridade e com o prazo para responder."
        />
      ) : (
        <div className="grid gap-3">
          {sorted.map((o) => (
            <CartaoOrdem key={o.id} o={o} papel="proprietario" demo={demo} onAtualizada={atualizar} />
          ))}
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

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4">
        <StatCard label="Em aberto" value={mine.filter((o) => o.status !== "resolvido").length} icon={Wrench} />
        <StatCard label="Resolvidas" value={mine.filter((o) => o.status === "resolvido").length} icon={CheckCircle2} />
      </div>

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
            </div>
            <SeletorPrioridade valor={priority} onChange={setPriority} />
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
          <Panel className="text-center text-sm text-muted">Você ainda não abriu nenhuma solicitação.</Panel>
        ) : (
          sortByPriority(mine).map((o) => (
            <CartaoOrdem
              key={o.id}
              o={o}
              papel="inquilino"
              demo={demo}
              onAtualizada={(nova) => setOrders(orders.map((x) => (x.id === nova.id ? nova : x)))}
            />
          ))
        )}
      </div>

      <ServiceOrderNotice className="mt-4" />
    </>
  );
}
