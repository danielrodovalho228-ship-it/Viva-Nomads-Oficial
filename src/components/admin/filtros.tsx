"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PERIODOS, type Periodo } from "@/lib/admin/visao-geral";

/**
 * Filtros do admin numa linha só, acima dos gráficos: período (7/30/90 dias,
 * ano, personalizado) e cidade. Tudo vai para a URL — o link é compartilhável.
 */
export function FiltrosAdmin({
  base,
  periodo,
  cidade,
  cidades,
}: {
  base: string;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
}) {
  const router = useRouter();
  const [de, setDe] = useState(periodo.inicio);
  const [ate, setAte] = useState(periodo.fim);

  function url(extra: Record<string, string | null>): string {
    const p = new URLSearchParams();
    const valores: Record<string, string | null> = {
      periodo: periodo.id,
      de: periodo.id === "custom" ? periodo.inicio : null,
      ate: periodo.id === "custom" ? periodo.fim : null,
      cidade,
      ...extra,
    };
    for (const [k, v] of Object.entries(valores)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-sage-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
        {PERIODOS.filter((p) => p.id !== "custom").map((p) => (
          <Link
            key={p.id}
            href={url({ periodo: p.id, de: null, ate: null })}
            aria-current={periodo.id === p.id ? "true" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              periodo.id === p.id ? "bg-forest text-white" : "border border-line text-ink hover:border-forest"
            )}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(url({ periodo: "custom", de, ate }));
        }}
      >
        <label className="text-xs text-muted">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="mt-0.5 block rounded-lg border border-line px-2 py-1.5 text-sm text-ink" />
        </label>
        <label className="text-xs text-muted">
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="mt-0.5 block rounded-lg border border-line px-2 py-1.5 text-sm text-ink" />
        </label>
        <button
          type="submit"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm",
            periodo.id === "custom" ? "bg-forest text-white" : "border border-line text-ink hover:border-forest"
          )}
        >
          Aplicar
        </button>
      </form>
      <label className="text-xs text-muted sm:ml-auto">
        Cidade
        <select
          value={cidade ?? ""}
          onChange={(e) => router.push(url({ cidade: e.target.value || null }))}
          className="mt-0.5 block w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink sm:w-48"
        >
          <option value="">Todas as cidades</option>
          {cidade && !cidades.includes(cidade) && <option value={cidade}>{cidade}</option>}
          {cidades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
