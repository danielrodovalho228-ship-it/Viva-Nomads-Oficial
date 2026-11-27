"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CampoData } from "@/components/ui/campo-data";
import { PERIODOS, type Periodo } from "@/lib/admin/visao-geral";
import { ABA_ADMIN } from "@/lib/admin/abas";
import { urlFiltrosAdmin } from "@/lib/admin/filtros-url";

/**
 * Filtros do admin numa linha só, acima dos gráficos: período (7/30/90 dias,
 * ano, personalizado) e cidade. Tudo vai para a URL — o link é compartilhável.
 *
 * E471: trocar o período ou a cidade faz navegação COMPLETA — a página inteira é renderizada de novo pelo servidor
 * com o período da URL (destaque, datas, rótulo e números da mesma leitura; nunca a URL nova com a tela velha). E as
 * datas De/Até seguem o período aplicado (antes ficavam presas no da primeira carga).
 */
export function FiltrosAdmin({
  base,
  periodo,
  cidade,
  cidades,
  manter,
}: {
  base: string;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
  /** Outros filtros da página que o período e a cidade mantêm (ex.: o recorte Real · Teste · Todos). */
  manter?: Record<string, string | null>;
}) {
  const [de, setDe] = useState(periodo.inicio);
  const [ate, setAte] = useState(periodo.fim);
  // As datas acompanham o período aplicado (ajuste no render, o padrão do React para estado que segue uma prop).
  const aplicado = `${periodo.inicio}|${periodo.fim}`;
  const [visto, setVisto] = useState(aplicado);
  if (visto !== aplicado) {
    setVisto(aplicado);
    setDe(periodo.inicio);
    setAte(periodo.fim);
  }

  const url = (extra: Record<string, string | null>) => urlFiltrosAdmin(base, periodo, cidade, manter, extra);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-sage-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODOS.filter((p) => p.id !== "custom").map((p) => (
          <a
            key={p.id}
            href={url({ periodo: p.id, de: null, ate: null })}
            aria-current={periodo.id === p.id ? "true" : undefined}
            data-testid="filtro-periodo-preset"
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              periodo.id === p.id ? ABA_ADMIN.ativa : ABA_ADMIN.inativa
            )}
          >
            {p.rotulo}
          </a>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.assign(url({ periodo: "custom", de, ate }));
        }}
      >
        <label className="text-xs text-muted">
          De
          <span className="mt-1 block w-44">
            <CampoData value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm text-ink" />
          </span>
        </label>
        <label className="text-xs text-muted">
          Até
          <span className="mt-1 block w-44">
            <CampoData value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm text-ink" />
          </span>
        </label>
        <button
          type="submit"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            periodo.id === "custom" ? ABA_ADMIN.ativa : ABA_ADMIN.inativa
          )}
        >
          Aplicar
        </button>
      </form>
      <label className="text-xs text-muted sm:ml-auto">
        Cidade
        <select
          value={cidade ?? ""}
          onChange={(e) => window.location.assign(url({ cidade: e.target.value || null }))}
          className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink sm:w-48"
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
