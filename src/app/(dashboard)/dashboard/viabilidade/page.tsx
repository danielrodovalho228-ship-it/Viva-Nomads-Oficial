"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingUp, Clock, Percent, Wallet } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { PlanGate } from "@/components/dashboard/plan-gate";
import { computeViability } from "@/lib/viability";
import { formatBRL } from "@/lib/utils";

export default function ViabilityPage() {
  return (
    <PlanGate title="Viabilidade de mobiliar">
      <Calc />
    </PlanGate>
  );
}

function Calc() {
  const [emptyRent, setEmptyRent] = useState(2000);
  const [furnishedRent, setFurnishedRent] = useState(3400);
  const [furnishingCost, setFurnishingCost] = useState(28000);
  const [occupancyPct, setOccupancyPct] = useState(85);
  const [monthlyCosts, setMonthlyCosts] = useState(350);

  const r = useMemo(
    () =>
      computeViability({
        emptyRent,
        furnishedRent,
        furnishingCost,
        occupancyPct,
        monthlyCosts,
      }),
    [emptyRent, furnishedRent, furnishingCost, occupancyPct, monthlyCosts]
  );

  const worthIt = r.annualUplift > 0;

  return (
    <>
      <PageTitle
        title="Viabilidade de mobiliar"
        subtitle="Vale a pena mobiliar este imóvel para temporada? Compare com alugar vazio."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <Panel title="Premissas">
          <div className="space-y-4">
            <Field
              label="Aluguel vazio (long-term)"
              hint="Quanto renderia alugando tradicional, por mês"
              value={emptyRent}
              onChange={setEmptyRent}
            />
            <Field
              label="Aluguel mobiliado (temporada)"
              hint="Mensal cobrado mobiliado por temporada"
              value={furnishedRent}
              onChange={setFurnishedRent}
            />
            <Field
              label="Investimento em mobília + enxoval"
              hint="Custo único para deixar pronto para morar"
              value={furnishingCost}
              onChange={setFurnishingCost}
            />
            <Field
              label="Custos operacionais (R$/mês)"
              hint="Limpeza, reposição, manutenção média"
              value={monthlyCosts}
              onChange={setMonthlyCosts}
            />
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">
                <span>Ocupação média esperada</span>
                <span className="font-title font-bold text-forest">{occupancyPct}%</span>
              </span>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={occupancyPct}
                onChange={(e) => setOccupancyPct(Number(e.target.value))}
                className="w-full accent-[var(--color-forest)]"
              />
              <span className="mt-1 block text-xs text-muted">
                ≈ {r.monthsOccupied.toFixed(1)} meses ocupados por ano
              </span>
            </label>
          </div>
        </Panel>

        {/* Resultados */}
        <div className="space-y-6">
          <div
            className={`rounded-2xl border p-6 ${
              worthIt
                ? "border-sage bg-sage-100"
                : "border-red-200 bg-red-50"
            }`}
          >
            <p className="text-sm font-medium text-muted">
              {worthIt ? "Ganho líquido extra ao mobiliar (ano)" : "Diferença anual (ano)"}
            </p>
            <p
              className={`mt-1 font-title text-4xl font-bold ${
                worthIt ? "text-forest" : "text-red-600"
              }`}
            >
              {worthIt ? "+" : ""}
              {formatBRL(r.annualUplift)}
            </p>
            <p className="mt-2 text-sm text-ink">
              {worthIt
                ? "Mobiliar para temporada rende mais que alugar vazio, mesmo após custos."
                : "Com estas premissas, alugar vazio rende mais. Ajuste preço ou ocupação."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Metric
              icon={Percent}
              label="Margem líquida"
              value={`${r.marginPct.toFixed(0)}%`}
            />
            <Metric icon={TrendingUp} label="ROI da mobília/ano" value={`${r.roiPct.toFixed(0)}%`} />
            <Metric
              icon={Clock}
              label="Payback da mobília"
              value={
                Number.isFinite(r.paybackMonths)
                  ? `${Math.ceil(r.paybackMonths)} meses`
                  : "—"
              }
            />
            <Metric
              icon={Wallet}
              label="Receita anual mobiliado"
              value={formatBRL(r.furnishedAnnualNet)}
            />
          </div>

          <Panel>
            <h3 className="flex items-center gap-2 font-title text-sm font-bold text-ink">
              <Calculator className="h-4 w-4 text-sage" /> Comparativo anual
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Mobiliado — receita bruta" value={formatBRL(r.furnishedAnnualGross)} />
              <Row
                label="Mobiliado — após custos"
                value={formatBRL(r.furnishedAnnualNet)}
                strong
              />
              <Row label="Vazio — receita bruta (12 meses)" value={formatBRL(r.emptyAnnualGross)} />
            </dl>
          </Panel>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        Estimativa para apoiar a decisão. Não considera impostos, depreciação da mobília nem
        vacância entre contratos além da ocupação informada.
      </p>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
          R$
        </span>
        <input
          type="number"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input pl-9"
        />
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-4">
      <Icon className="h-5 w-5 text-sage" />
      <p className="mt-2 text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-title text-xl font-bold text-forest">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-title font-bold text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
