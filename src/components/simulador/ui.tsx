"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { PLANOS, type PlanoId } from "@/config/planos";
import { geometriaBarras, rotuloValorBarra } from "@/lib/grafico-barras";

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
        {prefix === "R$" ? (
          // Dinheiro: texto no formato brasileiro ("3.300"), pela fonte única lerReais (complemento do prompt 27, parte B).
          <CampoReais
            semPrefixo
            value={value}
            onChange={(n) => {
              const v = Math.max(0, Math.round(n ?? 0));
              const acima = max !== undefined && v > max;
              setPassou(acima);
              onChange(acima ? (max as number) : v);
            }}
            className="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none"
          />
        ) : (
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
        )}
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

/** Como o condomínio/IPTU ou as contas chegam ao morador (prompt 15). Padrão da Viva: cobrado à parte. */
export function CobrancaToggle({
  rotulo,
  value,
  onChange,
  testid,
}: {
  rotulo: string;
  value: "aparte" | "incluido";
  onChange: (v: "aparte" | "incluido") => void;
  testid: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="mt-1.5 grid grid-cols-2 gap-2" data-testid={testid}>
      {(["aparte", "incluido"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            value === v ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
          }`}
        >
          {v === "aparte" ? "Cobrado à parte" : "Incluído no valor mensal"}
        </button>
      ))}
    </div>
  );
}

/** "Como calculamos" (prompt 15): as fórmulas em texto simples, abertas sob demanda. */
export function ComoCalculamos({ itens, testid }: { itens: string[]; testid: string }) {
  return (
    <details className="group mt-6 rounded-2xl border border-sage-200 bg-white p-5" data-testid={testid}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-title text-base font-bold text-ink">
        Como calculamos
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {itens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </details>
  );
}

/** Barra horizontal de um gráfico simples (valor com sinal; negativos aparecem esmaecidos). */
export function BarraValor({
  label,
  valor,
  max,
  tone = "forest",
  formatar,
}: {
  label: string;
  valor: number;
  max: number;
  tone?: "forest" | "sage" | "champagne";
  formatar: (v: number) => string;
}) {
  const pct = Math.min(100, (Math.abs(valor) / Math.max(1, max)) * 100);
  const cor = tone === "forest" ? "bg-forest" : tone === "sage" ? "bg-sage" : "bg-champagne";
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted sm:w-28">{label}</span>
      <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${cor} ${valor < 0 ? "opacity-40" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-medium text-ink">{formatar(valor)}</span>
    </div>
  );
}

/**
 * Gráfico de colunas agrupadas com valores negativos (prompt 27, item 4): escala do menor ao maior valor, linha do
 * zero visível, barra negativa com cor própria descendo do zero (mínimo de 4 px) e o rótulo do valor FORA da barra.
 * A tabela equivalente fica para leitor de tela.
 */
export function GraficoColunas({
  grupos,
  series,
  formatar,
  legenda,
  testid,
}: {
  grupos: { rotulo: string; valores: number[] }[];
  series: { nome: string; cor: string }[];
  formatar: (v: number) => string;
  legenda: string;
  testid?: string;
}) {
  const ALTURA = 160;
  const MARGEM = 18; // espaço para o rótulo acima/abaixo
  const geo = geometriaBarras(grupos.flatMap((g) => g.valores), ALTURA);
  let i = 0;
  return (
    <figure data-testid={testid} className="relative overflow-hidden">
      {/* px-3: espaço para o rótulo das colunas da ponta não sair da tela a 390 px. */}
      <div aria-hidden className="relative px-3" style={{ height: ALTURA + 2 * MARGEM }}>
        <div
          className="absolute inset-x-0 border-t border-ink/50"
          style={{ top: MARGEM + geo.zeroY }}
          data-testid={testid ? `${testid}-zero` : undefined}
        />
        <div className="absolute inset-y-0 left-3 right-3 flex gap-3 sm:gap-6">
          {grupos.map((g) => (
            <div key={g.rotulo} className="flex min-w-0 flex-1 gap-1">
              {g.valores.map((v, s) => {
                const b = geo.barras[i++];
                const serie = series[s];
                return (
                  <div key={serie.nome} className="relative min-w-0 flex-1">
                    <div
                      className={`absolute inset-x-0 ${b.negativo ? "rounded-b bg-red-400" : `rounded-t ${serie.cor}`}`}
                      style={{ top: MARGEM + b.topo, height: b.altura }}
                      data-testid={testid ? `${testid}-barra` : undefined}
                      data-grupo={g.rotulo}
                      data-serie={serie.nome}
                      data-valor={v}
                    />
                    <span
                      className={`absolute inset-x-[-12px] whitespace-nowrap text-center text-[10px] font-medium leading-none ${b.negativo ? "text-red-700" : "text-ink"}`}
                      style={b.negativo ? { top: MARGEM + b.topo + b.altura + 3 } : { top: MARGEM + b.topo - 13 }}
                    >
                      {rotuloValorBarra(v, formatar)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-1 flex gap-3 px-3 sm:gap-6">
        {grupos.map((g) => (
          <p key={g.rotulo} className="min-w-0 flex-1 text-center text-xs text-muted">
            {g.rotulo}
          </p>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.cor}`} /> {s.nome}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Abaixo de zero
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{legenda}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            {series.map((s) => (
              <th key={s.nome} scope="col">
                {s.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.rotulo}>
              <th scope="row">{g.rotulo}</th>
              {g.valores.map((v, s) => (
                <td key={series[s].nome}>{rotuloValorBarra(v, formatar)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
