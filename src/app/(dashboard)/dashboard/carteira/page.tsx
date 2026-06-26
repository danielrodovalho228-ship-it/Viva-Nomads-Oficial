import type { Metadata } from "next";
import {
  Building2,
  KeyRound,
  Wallet,
  AlertTriangle,
  CircleDot,
  Home,
  Handshake,
} from "lucide-react";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { PlanGate } from "@/components/dashboard/plan-gate";
import { SAMPLE_PORTFOLIO, portfolioMetrics, type PortfolioUnit } from "@/lib/portfolio";
import { isSupabaseConfigured } from "@/lib/env";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Carteira — Viva Nomads",
};

export default function PortfolioPage() {
  return (
    <PlanGate title="Carteira">
      <Portfolio />
    </PlanGate>
  );
}

function Portfolio() {
  // Modo real: carteira começa vazia (sem imóveis fictícios); demo: exemplos.
  const units = isSupabaseConfigured() ? [] : SAMPLE_PORTFOLIO;

  if (units.length === 0) {
    return (
      <>
        <PageTitle
          title="Carteira consolidada"
          subtitle="Ocupação, receita e contratos a vencer de todos os imóveis sob sua gestão."
        />
        <EmptyState
          icon={Building2}
          title="Sua carteira está vazia"
          text="Quando você tiver imóveis com contratos ativos, a visão consolidada — ocupação, receita mensal e vencimentos — aparece aqui."
        />
      </>
    );
  }

  const m = portfolioMetrics(units);

  return (
    <>
      <PageTitle
        title="Carteira consolidada"
        subtitle="Ocupação, receita e contratos a vencer de todos os imóveis sob sua gestão."
      />

      {/* Indicadores principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Imóveis na carteira" value={m.total} icon={Building2} />
        <StatCard label="Ocupação" value={`${m.occupancyPct}%`} icon={CircleDot} />
        <StatCard label="Vagos" value={m.vacant} icon={KeyRound} />
        <StatCard label="Receita mensal" value={formatBRL(m.monthlyRevenue)} icon={Wallet} />
      </div>

      {/* Alertas */}
      {(m.expiring30.length > 0 || m.vacant > 0) && (
        <div className="mt-6 rounded-2xl border border-champagne bg-champagne/10 p-5">
          <h2 className="flex items-center gap-2 font-title text-sm font-bold text-ink">
            <AlertTriangle className="h-4 w-4 text-champagne" /> Atenção
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {m.expiring30.length > 0 && (
              <li>
                {m.expiring30.length} contrato(s) vencem em até 30 dias — renove ou prepare a
                reposição.
              </li>
            )}
            {m.vacant > 0 && (
              <li>
                {m.vacant} imóvel(is) vago(s) sem receita — priorize a divulgação.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Próprio vs operado */}
        <Panel title="Próprio vs. operado">
          <div className="space-y-4">
            <SplitRow
              icon={Home}
              label="Imóveis próprios"
              count={m.ownCount}
              revenue={m.ownRevenue}
            />
            <SplitRow
              icon={Handshake}
              label="Operados (sublocação)"
              count={m.subleasedCount}
              revenue={m.subleasedRevenue}
            />
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="bg-forest"
              style={{ width: `${pct(m.ownCount, m.total)}%` }}
              title="Próprios"
            />
            <div
              className="bg-sage"
              style={{ width: `${pct(m.subleasedCount, m.total)}%` }}
              title="Operados"
            />
          </div>
        </Panel>

        {/* Contratos a vencer */}
        <Panel title="Contratos a vencer" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <ExpiringColumn title="Em 30 dias" tone="urgent" units={m.expiring30} />
            <ExpiringColumn title="31–60 dias" tone="warn" units={m.expiring60} />
            <ExpiringColumn title="61–90 dias" tone="calm" units={m.expiring90} />
          </div>
        </Panel>
      </div>

      {/* Lista de imóveis */}
      <Panel title="Imóveis" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sage-200 text-left text-muted">
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium">Situação</th>
                <th className="pb-2 font-medium">Inquilino</th>
                <th className="pb-2 text-right font-medium">Receita/mês</th>
                <th className="pb-2 text-right font-medium">Vence em</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-sage-200/60 last:border-0">
                  <td className="py-3">
                    <p className="font-medium text-ink">{u.title}</p>
                    <p className="text-xs text-muted">{u.neighborhood}</p>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      {u.ownership === "own" ? (
                        <Home className="h-3.5 w-3.5 text-forest" />
                      ) : (
                        <Handshake className="h-3.5 w-3.5 text-sage" />
                      )}
                      {u.ownership === "own" ? "Próprio" : "Operado"}
                    </span>
                  </td>
                  <td className="py-3">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="py-3 text-ink">{u.tenantName ?? "—"}</td>
                  <td className="py-3 text-right text-ink">
                    {u.monthlyRent > 0 ? formatBRL(u.monthlyRent) : "—"}
                  </td>
                  <td className="py-3 text-right text-ink">
                    {u.contractEndsInDays != null ? `${u.contractEndsInDays} dias` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function SplitRow({
  icon: Icon,
  label,
  count,
  revenue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  revenue: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ink">
        <Icon className="h-4 w-4 text-sage" /> {label}
      </span>
      <span className="text-right">
        <span className="font-title font-bold text-ink">{count}</span>
        <span className="ml-2 text-xs text-muted">{formatBRL(revenue)}/mês</span>
      </span>
    </div>
  );
}

function ExpiringColumn({
  title,
  tone,
  units,
}: {
  title: string;
  tone: "urgent" | "warn" | "calm";
  units: PortfolioUnit[];
}) {
  const dot =
    tone === "urgent" ? "bg-red-500" : tone === "warn" ? "bg-champagne" : "bg-sage";
  return (
    <div className="rounded-xl border border-sage-200 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {title}
      </p>
      {units.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {units.map((u) => (
            <li key={u.id} className="text-sm">
              <p className="font-medium text-ink">{u.title}</p>
              <p className="text-xs text-muted">
                {u.contractEndsInDays} dias · {u.tenantName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: PortfolioUnit["status"] }) {
  const occupied = status === "occupied";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        occupied ? "bg-sage-100 text-forest" : "bg-red-50 text-red-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${occupied ? "bg-forest" : "bg-red-500"}`} />
      {occupied ? "Ocupado" : "Vago"}
    </span>
  );
}
