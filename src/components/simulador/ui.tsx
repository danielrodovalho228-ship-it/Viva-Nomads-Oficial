"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { PLANOS, type PlanoId } from "@/config/planos";

/**
 * Valores de referência dos simuladores. A foto fica na capa da tela (PageTitle
 * capa), então aqui é um painel claro: ícone, título curto e 4 números em grade par.
 */
export function SimHero({
  icon: Icon,
  titulo,
  subtitulo,
  stats,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo: string;
  stats: { label: string; valor: string }[];
}) {
  return (
    <section className="rounded-2xl border border-sage-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-title text-lg font-bold text-ink">{titulo}</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">{subtitulo}</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
          Valores de referência
        </span>
      </div>
      <div className="mt-4 grid auto-rows-fr grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 p-3">
            <p className="font-title text-lg font-bold text-forest">{s.valor}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Input numérico com prefixo (R$) e passo. */
export function NumInput({
  label,
  value,
  onChange,
  step = 1,
  prefix,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  /** Teto do campo: acima dele, usa o máximo e avisa (antes aceitava R$ 99 mi). */
  max?: number;
}) {
  const [passou, setPassou] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center rounded-xl border border-sage-200 focus-within:border-sage">
        {prefix && <span className="pl-3 text-sm text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Math.max(0, Math.round(Number(e.target.value) || 0));
            const acima = max !== undefined && v > max;
            setPassou(acima);
            onChange(acima ? (max as number) : v);
          }}
          className="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none"
        />
      </div>
      {passou && max !== undefined && (
        <span className="mt-1 block text-xs text-amber-700">
          Máximo aceito: {prefix ? `${prefix} ` : ""}
          {max.toLocaleString("pt-BR")}. Usamos esse valor no cálculo.
        </span>
      )}
    </label>
  );
}

/** Card de resultado (rótulo + valor + dica opcional). */
export function ResultCard({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-sage-200 bg-white p-4 ${className ?? ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-title text-xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/** Seletor de plano (pílulas) — usa os planos da fonte única. */
export function PlanoPills({ value, onChange }: { value: PlanoId; onChange: (v: PlanoId) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLANOS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === p.id ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
          }`}
        >
          {p.nome}
        </button>
      ))}
    </div>
  );
}

/** Disclaimer padrão de simulação (regra de ouro). */
export function SimDisclaimer() {
  return (
    <p className="mt-6 flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-xs text-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      Estimativa ilustrativa — não é promessa de rentabilidade. Depende da ocupação real, do valor
      combinado e do mercado. A Viva Nomads calcula e documenta; o valor mensal vai direto ao
      proprietário — a plataforma nunca retém valores.
    </p>
  );
}
