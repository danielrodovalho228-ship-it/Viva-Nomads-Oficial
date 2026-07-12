"use client";

import { useState } from "react";
import { Calculator, HelpCircle } from "lucide-react";
import { PLANS, COMMISSION_BY_PLAN } from "@/lib/constants";
import { formatBRL, cn } from "@/lib/utils";

/**
 * Calculadora de planos (clareza de preço, linguagem do dia a dia): o
 * proprietário informa o aluguel e quantos imóveis aluga por mês, e vê o total
 * mensal de cada plano (taxa por aluguel + mensalidade), destacando o de melhor
 * custo. Só textos foram simplificados — a matemática é a mesma.
 */
export function CommissionCalculator() {
  const [rent, setRent] = useState(2500);
  const [closings, setClosings] = useState(1);

  const rows = PLANS.filter((p) => p.price !== null).map((p) => {
    const commission = COMMISSION_BY_PLAN[p.id] ?? 0;
    const subscription = p.price ?? 0;
    const commissionCost = Math.round(rent * commission) * closings;
    const total = commissionCost + subscription;
    return { id: p.id, name: p.name, commission, subscription, commissionCost, total };
  });
  const best = rows.reduce((a, b) => (b.total < a.total ? b : a), rows[0]);

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-sage-200 bg-white p-6 sm:p-8">
      <h3 className="flex items-center gap-2 font-title text-xl font-bold text-ink">
        <Calculator className="h-5 w-5 text-forest" /> Qual plano vale mais a pena para você?
      </h3>
      <p className="mt-1 text-sm text-muted">
        Você só paga quando aluga. A taxa é cobrada uma única vez por imóvel alugado,
        calculada sobre o primeiro mês de aluguel. Faça a conta:
      </p>
      <p className="mt-2 text-sm text-muted">
        Cada{" "}
        <Tip text="É quando um inquilino assina o contrato e aluga o seu imóvel.">
          aluguel fechado
        </Tip>{" "}
        tem uma taxa única. Quanto mais você aluga, mais vale a pena uma mensalidade com
        taxa menor.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Aluguel médio (R$/mês)</span>
          <input
            type="number"
            min={0}
            value={rent || ""}
            onChange={(e) => setRent(Number(e.target.value))}
            className="w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">
            <span>Imóveis alugados por mês</span>
            <span className="rounded-full bg-sage-100 px-2.5 py-0.5 font-title text-sm font-bold text-forest">
              {closings}
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={closings}
            onChange={(e) => setClosings(Number(e.target.value))}
            aria-label="Imóveis alugados por mês"
            className="mt-2.5 w-full accent-forest"
          />
          <span className="mt-1 flex justify-between text-[11px] text-muted">
            <span>1</span>
            <span>10+</span>
          </span>
          <span className="mt-1 block text-[11px] text-muted">
            quantos contratos você fecha por mês
          </span>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-sage-200 text-left text-muted">
              <th className="pb-2 font-medium">Plano</th>
              <th className="pb-2 font-medium">Taxa por aluguel</th>
              <th className="pb-2 font-medium">Mensalidade</th>
              <th className="pb-2 text-right font-medium">Total naquele mês*</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-sage-200/60",
                  r.id === best.id && "bg-sage-100/60"
                )}
              >
                <td className="py-2.5 font-medium text-ink">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{r.name}</span>
                    {r.id === best.id && (
                      <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold text-white">
                        melhor custo
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 text-ink">
                  {Math.round(r.commission * 100)}% · {formatBRL(r.commissionCost)}
                </td>
                <td className="py-2.5 text-ink">
                  {r.subscription === 0 ? "—" : `${formatBRL(r.subscription)}/mês`}
                </td>
                <td className="py-2.5 text-right font-title font-bold text-forest">
                  {formatBRL(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
        <strong className="text-ink">* A taxa por aluguel é única, por contrato.</strong> Ela só
        entra na conta no mês em que você fecha o contrato — nos meses seguintes você paga
        apenas a mensalidade. A tabela mostra o total do mês em que você fecha {closings}{" "}
        {closings === 1 ? "contrato" : "contratos"}.
      </p>
      <p className="mt-3 text-xs text-muted">
        Exemplo: um imóvel de {formatBRL(rent)} por mês. No mês em que você fecha {closings}{" "}
        {closings === 1 ? "contrato" : "contratos"}, no plano{" "}
        <strong className="text-ink">{best.name}</strong> você paga {formatBRL(best.total)} no
        total (mensalidade + taxa única de cada contrato). Quanto mais imóveis você aluga, mais
        vale a pena a mensalidade com taxa menor.
      </p>
    </div>
  );
}

/** Ajuda inline (tooltip nativo) para explicar um termo sem sair da página. */
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span
      title={text}
      className="inline-flex cursor-help items-center gap-0.5 text-ink underline decoration-dotted underline-offset-2"
    >
      {children}
      <HelpCircle className="h-3.5 w-3.5 text-muted" />
    </span>
  );
}
