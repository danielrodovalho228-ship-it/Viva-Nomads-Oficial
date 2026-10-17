"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingDown, AlertTriangle, Building2, User } from "lucide-react";
import { simulateTax, AVISO_IBS_CBS_LIBERADO, AVISO_IBS_CBS_PF } from "@/lib/tax";
import { limitar, avisoTeto, MAX_RECEITA_CARTEIRA } from "@/lib/campos-valor";
import { formatBRL, cn, numBR } from "@/lib/utils";

/**
 * Simulador tributário PF x PJ (educativo, não é aconselhamento fiscal).
 * Base: Reforma Tributária / LC 214/2025.
 */
export function TaxSimulator() {
  const [monthlyRent, setMonthlyRent] = useState(10000);
  const [propertyCount, setPropertyCount] = useState(4);
  const [deducoes, setDeducoes] = useState(0);
  const [outros, setOutros] = useState(0);

  const r = useMemo(
    () =>
      simulateTax({
        monthlyRent: limitar(monthlyRent, MAX_RECEITA_CARTEIRA),
        propertyCount: Math.max(0, Math.floor(propertyCount)),
        monthlyDeductions: limitar(deducoes, MAX_RECEITA_CARTEIRA),
        otherMonthlyIncome: limitar(outros, MAX_RECEITA_CARTEIRA),
      }),
    [monthlyRent, propertyCount, deducoes, outros]
  );
  const aviso = avisoTeto(monthlyRent, MAX_RECEITA_CARTEIRA);

  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-forest" />
        <h3 className="font-title text-lg font-bold text-ink">Simulador tributário PF × PJ</h3>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Receita mensal das locações (total)
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
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Despesas que você paga por mês (IPTU, condomínio, administração)
          </span>
          <input
            type="number"
            min={0}
            value={deducoes || ""}
            onChange={(e) => setDeducoes(Number(e.target.value))}
            className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Seus outros rendimentos por mês (salário, pró-labore)
          </span>
          <input
            type="number"
            min={0}
            value={outros || ""}
            onChange={(e) => setOutros(Number(e.target.value))}
            className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            data-testid="tax-outros-rendimentos"
          />
          <span className="mt-1 block text-xs text-muted">A receita das locações soma a eles na tabela do imposto de renda.</span>
        </label>
      </div>
      {aviso && <p className="mt-2 text-xs text-amber-700">{aviso}</p>}

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
              ? "Carnê-leão (tabela progressiva) + IBS/CBS (regra cumulativa atendida)"
              : "Carnê-leão pela tabela progressiva (não atinge IBS/CBS)"
          }
        />
        <Card
          active={r.recommendation === "pj"}
          icon={Building2}
          title="Pessoa Jurídica (CNPJ)"
          tax={r.pjAnnualTax + r.pjAnnualCost}
          rate={r.annualRevenue > 0 ? (r.pjAnnualTax + r.pjAnnualCost) / r.annualRevenue : 0}
          note={`Lucro presumido ${formatBRL(r.pjAnnualTax)} + custo de manter a empresa ${formatBRL(r.pjAnnualCost)}`}
        />
      </div>

      {/* Resultado da simulação — linguagem ilustrativa, não prescritiva */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-4 text-sm" data-testid="tax-resultado">
        <TrendingDown className="h-5 w-5 shrink-0 text-sage" />
        <span className="text-muted">
          Nesta simulação, o cenário{" "}
          <strong className="text-ink">{r.taxSavings > 0 ? "Pessoa Jurídica" : "Pessoa Física"}</strong> sai mais em conta: a diferença
          de imposto é de {formatBRL(Math.abs(r.taxDifference))}/ano e, descontado o custo de manter a empresa (
          {formatBRL(r.pjAnnualCost)}/ano), a vantagem real é de{" "}
          <strong className="text-forest">{formatBRL(Math.abs(r.taxSavings))}</strong>/ano. Valores estimados.
        </span>
      </div>

      {/* IBS/CBS: só pela regra cumulativa e só depois da revisão do Sérgio (AVISO_IBS_CBS_LIBERADO). */}
      {AVISO_IBS_CBS_LIBERADO && r.ibsCbsAviso && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700" data-testid="tax-aviso-ibs-cbs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {AVISO_IBS_CBS_PF.texto} <span className="block text-amber-800/80">{AVISO_IBS_CBS_PF.fonte}</span>
          </span>
        </p>
      )}

      {/* Ressalva obrigatória — visível, não é aconselhamento fiscal */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          <strong>Esta é uma simulação educativa com valores estimados.</strong> Não
          substitui orientação de um contador. Consulte um profissional antes de decidir.
          Cálculos baseados na legislação vigente em junho de 2026 (Reforma Tributária /
          LC 214/2025). Alíquotas sujeitas a alteração.
        </p>
      </div>

      {/* Glossário das siglas — abre no lugar (melhor que tooltip no mobile). */}
      <details className="mt-3 rounded-xl border border-sage-200 bg-white p-3 text-xs">
        <summary className="cursor-pointer font-medium text-forest">
          O que significam as siglas?
        </summary>
        <dl className="mt-2 space-y-1.5 text-muted">
          {[
            ["IBS", "Imposto sobre Bens e Serviços — novo imposto (estados/municípios) da Reforma Tributária."],
            ["CBS", "Contribuição sobre Bens e Serviços — novo tributo federal da Reforma Tributária."],
            ["LC 214/2025", "Lei Complementar que regulamenta a Reforma Tributária (base destes cálculos)."],
            ["Lucro presumido", "Regime em que o imposto da empresa é calculado sobre uma margem de lucro presumida por lei, não sobre o lucro real."],
            ["IRPF", "Imposto de Renda da Pessoa Física."],
            ["NFS-e", "Nota Fiscal de Serviço eletrônica."],
          ].map(([sigla, desc]) => (
            <div key={sigla}>
              <dt className="inline font-semibold text-ink">{sigla}</dt>
              <dd className="inline"> — {desc}</dd>
            </div>
          ))}
        </dl>
      </details>
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
      <p className="text-xs text-muted">por ano · ~{numBR(rate * 100, 2)}% efetivo</p>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
  );
}
