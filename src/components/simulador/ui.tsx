"use client";

import Image from "next/image";
import { Info } from "lucide-react";
import { PLANOS, type PlanoId } from "@/config/planos";

/** Banner de topo dos simuladores (gradiente verde → sálvia + mini-stats). */
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
    <section className="relative overflow-hidden rounded-2xl p-6 text-white sm:p-8">
      {/* Fundo: foto de interior (Fase 2.4) SOB o gradiente ~0.85 — o texto manda. */}
      <Image
        src="/media/banner-simulador.webp"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="pointer-events-none object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-forest/95 to-sage/85" />
      <Icon aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-white/[0.08]" />
      <div className="relative">
        <h2 className="font-title text-2xl font-bold sm:text-3xl">{titulo}</h2>
        <p className="mt-2 max-w-2xl text-white/85">{subtitulo}</p>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
              <p className="font-title text-lg font-bold">{s.valor}</p>
              <p className="text-xs text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20">
          Valores de referência
        </span>
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center rounded-xl border border-sage-200 focus-within:border-sage">
        {prefix && <span className="pl-3 text-sm text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}

/** Card de resultado (rótulo + valor + dica opcional). */
export function ResultCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-4">
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
      combinado e do mercado. A Viva Nomads calcula e documenta; o aluguel vai direto ao
      proprietário — a plataforma nunca retém valores.
    </p>
  );
}
