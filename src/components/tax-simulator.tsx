"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingDown, AlertTriangle, Building2, User } from "lucide-react";
import { simulateTax } from "@/lib/tax";
import { formatBRL, cn } from "@/lib/utils";

/**
 * Simulador tributário PF x PJ (educativo, não é aconselhamento fiscal).
 * Base: Reforma Tributária / LC 214/2025.
 */
export function TaxSimulator() {
  const [monthlyRent, setMonthlyRent] = useState(10000);
  const [propertyCount, setPropertyCount] = useState(4);

  const r = useMemo(
    () => simulateTax({ monthlyRent, propertyCount }),
    [monthlyRent, propertyCount]
  );

  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-forest" />
        <h3 className="font-title text-lg font-bold text-ink">Simulador tributário PF × PJ</h3>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Receita de aluguel mensal (total)
          </span>
          <input
            type="number"
            min={0}
            value={monthlyRent || ""}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Nº de imóveis locados</span>
          <input
            type="number"
            min={0}
            value={propertyCount || ""}
            onChange={(e) => setPropertyCount(Number(e.target.value))}
            className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
          />
        </label>
      </div>

      {/* Resultado */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Card
          active={r.recommendation === "pf"}
          icon={User}
          title="Pessoa Física (CPF)"
          tax={r.pfAnnualTax}
          rate={r.pfRate}
          note={
            r.pfIsContributor
              ? "Contribuinte de IBS/CBS (regra cumulativa atendida)"
              : "Apenas IRPF (não atinge IBS/CBS)"
          }
        />
        <Card
          active={r.recommendation === "pj"}
          icon={Building2}
          title="Pessoa Jurídica (CNPJ)"
          tax={r.pjAnnualTax}
          rate={r.pjRate}
          note="Lucro presumido + IBS/CBS"
        />
      </div>

      {/* Resultado da simulação — linguagem ilustrativa, não prescritiva */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-4 text-sm">
        <TrendingDown className="h-5 w-5 shrink-0 text-sage" />
        <span className="text-muted">
          Nesta simulação, o cenário{" "}
          <strong className="text-ink">
            {r.taxSavings > 0 ? "Pessoa Jurídica" : "Pessoa Física"}
          </strong>{" "}
          resultaria em menor carga estimada — diferença de{" "}
          <strong className="text-forest">{formatBRL(Math.abs(r.taxSavings))}</strong>/ano.
          Valores estimados.
        </span>
      </div>

      {r.needsNfse && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          A partir de ago/2026, este perfil deve emitir NFS-e com destaque de CBS/IBS.
          Procure um contador.
        </p>
      )}

      {/* Ressalva obrigatória — visível, não é aconselhamento fiscal */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          <strong>Esta é uma simulação educativa com valores estimados.</strong> Não
          substitui orientação de um contador. Consulte um profissional antes de decidir.
          Base: Reforma Tributária / LC 214/2025.
        </p>
      </div>
    </div>
  );
}

function Card({
  active,
  icon: Icon,
  title,
  tax,
  rate,
  note,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tax: number;
  rate: number;
  note: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4",
        active ? "border-forest bg-sage-100" : "border-sage-200"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", active ? "text-forest" : "text-sage")} />
        <span className="font-title font-bold text-ink">{title}</span>
      </div>
      <p className="mt-3 font-title text-2xl font-bold text-forest">{formatBRL(tax)}</p>
      <p className="text-xs text-muted">por ano · ~{(rate * 100).toFixed(2)}%</p>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
  );
}
