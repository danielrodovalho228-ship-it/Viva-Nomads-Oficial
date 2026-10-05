"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { Sparkline, Funil } from "@/components/admin/graficos";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Download,
  Home,
  Info,
  Megaphone,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCOS,
  PERIODOS,
  PRECISA,
  csvVisaoGeral,
  fmtHoras,
  fmtInteiro,
  fmtPct,
  fmtReais,
  formatar,
  funil,
  mrr,
  num,
  rotuloPeriodo,
  variacao,
  type Indicador,
  type Metricas,
  type Periodo,
} from "@/lib/admin/visao-geral";
import type { VisaoGeral } from "@/lib/data/admin-visao-geral";

export function VisaoGeralClient({
  dados,
  aviso,
  periodo,
  cidade,
  cidades,
}: {
  dados: VisaoGeral | null;
  aviso: string | null;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
}) {
  const atual: Metricas = dados?.atual ?? {};
  const anterior: Metricas = dados?.anterior ?? {};
  const agora: Metricas = dados?.agora ?? {};
  const receita = mrr((dados?.agora?.assinaturas as Record<string, unknown> | null | undefined) ?? null);

  function baixarCsv() {
    const blob = new Blob(["﻿" + csvVisaoGeral(atual, anterior, periodo, cidade)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-visao-geral-${periodo.inicio}-a-${periodo.fim}${cidade ? "-" + cidade.toLowerCase().replace(/\s+/g, "-") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageTitle title="Administração" subtitle="Números reais da plataforma e o que precisa da equipe." />

      <Filtros periodo={periodo} cidade={cidade} cidades={cidades} />

      {aviso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>
      )}

      <PrecisaAgora precisa={dados?.precisa ?? null} />

      <section aria-label="Agora" className="mb-6">
        <h2 className="mb-3 font-title text-lg font-bold text-ink">Agora</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <StatCard label="Usuários" value={fmtInteiro(num(agora.usuarios))} icon={Users} />
          <StatCard label="Imóveis ativos" value={fmtInteiro(num(agora.imoveis_ativos))} icon={Home} />
          <StatCard label="Rascunhos" value={fmtInteiro(num(agora.rascunhos))} icon={Home} />
          <StatCard label="Donos com anúncio" value={fmtInteiro(num(agora.proprietarios_com_anuncio))} icon={Building2} />
          <StatCard label="Pedidos ativos" value={fmtInteiro(num(agora.pedidos_ativos))} icon={Megaphone} href="/admin/pedidos" />
          <StatCard label="MRR" value={fmtReais(receita.valor)} icon={CreditCard} />
          <StatCard label="Fundadores" value={fmtInteiro(num(agora.fundadores))} icon={Star} />
        </div>
        <p className="mt-2 text-xs text-muted">
          MRR = assinaturas ativas × preço mensal do plano ({fmtInteiro(receita.ativas)} ativas
          {receita.semPreco > 0 ? `; ${receita.semPreco} no Gestor, sob consulta, fora do valor` : ""}).
          {cidade ? " Usuários, MRR e Fundadores não têm cidade: com filtro, aparecem como \"—\"." : ""}
        </p>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rotuloPeriodo(periodo.inicio, periodo.fim)} ({periodo.dias} {periodo.dias === 1 ? "dia" : "dias"})
          {dados ? ` · comparado a ${rotuloPeriodo(dados.periodo.inicio_anterior, dados.periodo.fim_anterior)}` : ""}
          {cidade ? ` · ${cidade}` : ""}
        </p>
        <button
          type="button"
          onClick={baixarCsv}
          disabled={!dados}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-ink hover:border-forest disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Baixar CSV
        </button>
      </div>

      <div className="grid gap-6">
        {BLOCOS.map((b) => (
          <Panel key={b.id} title={b.titulo}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {b.indicadores.map((ind) => (
                <CardIndicador key={ind.chave} ind={ind} atual={atual} anterior={anterior} serie={dados?.serie ?? []} />
              ))}
            </div>
          </Panel>
        ))}

        <Panel title="Funil do período">
          <FunilPeriodo m={atual} />
        </Panel>
      </div>

      {dados && (
        <p className="mt-6 text-xs text-muted">
          Atualizado às{" "}
          {new Date(dados.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
          . Os números ficam guardados por até 5 minutos.
        </p>
      )}
    </>
  );
}

// ── Filtros: período e cidade (uma linha acima dos gráficos) ─────────────────
function Filtros({ periodo, cidade, cidades }: { periodo: Periodo; cidade: string | null; cidades: string[] }) {
  const router = useRouter();
  const [de, setDe] = useState(periodo.inicio);
  const [ate, setAte] = useState(periodo.fim);

  function url(extra: Record<string, string | null>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      periodo: periodo.id,
      de: periodo.id === "custom" ? periodo.inicio : null,
      ate: periodo.id === "custom" ? periodo.fim : null,
      cidade,
      ...extra,
    };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin?${qs}` : "/admin";
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

// ── Card de indicador: valor, variação, sparkline e o "i" ────────────────────
function CardIndicador({
  ind,
  atual,
  anterior,
  serie,
}: {
  ind: Indicador;
  atual: Metricas;
  anterior: Metricas;
  serie: Record<string, unknown>[];
}) {
  const [aberto, setAberto] = useState(false);
  const a = ind.calc(atual);
  const p = ind.calc(anterior);
  const vari = variacao(a, p);
  const bom = vari.direcao === "igual" || vari.direcao === null ? null : (vari.direcao === "sobe") !== !!ind.menorMelhor;
  const pontos = ind.serie
    ? serie
        .map((s) => ({ dia: String(s.dia), v: num(s[ind.serie as string]) }))
        .filter((s): s is { dia: string; v: number } => s.v !== null)
    : [];
  const Icone = vari.direcao === "sobe" ? TrendingUp : vari.direcao === "desce" ? TrendingDown : Minus;
  const idFormula = `formula-${ind.chave}`;

  return (
    <div className="min-w-0 rounded-xl border border-line p-3" data-indicador={ind.chave}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted">{ind.rotulo}</span>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls={idFormula}
          aria-label={`Como é calculado: ${ind.rotulo}`}
          className="shrink-0 rounded-full p-0.5 text-muted hover:text-forest"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 font-title text-2xl font-bold text-ink" data-valor>
        {formatar(a, ind.formato)}
      </p>
      {a === null && <p className="text-xs text-muted">sem dados no período</p>}
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-xs",
          bom === null ? "text-muted" : bom ? "text-green-700" : "text-red-700"
        )}
      >
        {vari.texto === "—" ? (
          <span>sem comparação com o período anterior</span>
        ) : (
          <>
            <Icone className="h-3.5 w-3.5" aria-hidden />
            <span>
              {vari.texto}
              <span className="text-muted"> vs. anterior ({formatar(p, ind.formato)})</span>
            </span>
          </>
        )}
      </p>
      {ind.nota && <p className="mt-1 text-xs text-muted">{ind.nota}</p>}
      {pontos.length > 1 && (
        <div className="mt-2">
          <Sparkline pontos={pontos} rotulo={ind.rotulo} />
        </div>
      )}
      {aberto && (
        <p id={idFormula} className="mt-2 rounded-lg bg-sage-100 px-2.5 py-2 text-xs text-ink">
          {ind.formula}
        </p>
      )}
    </div>
  );
}

// ── Funil ────────────────────────────────────────────────────────────────────
function FunilPeriodo({ m }: { m: Metricas }) {
  const etapas = funil(m).map((e, i) => ({
    rotulo: e.rotulo,
    valor: e.valor,
    texto: i === 0 ? fmtInteiro(e.valor) : `${fmtInteiro(e.valor)} · ${fmtPct(e.daAnterior)}`,
  }));
  const vazio = etapas.every((e) => !e.valor);
  return (
    <>
      <p className="mb-3 text-xs text-muted">
        Da busca ao contrato. O % é sobre a etapa anterior; etapa anterior zerada mostra &quot;—&quot;. Buscas, anúncios vistos e
        início de candidatura vêm dos eventos anônimos de uso.
      </p>
      {vazio ? (
        <p className="text-sm text-muted">— sem dados no período</p>
      ) : (
        <Funil etapas={etapas} />
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">Ver como tabela</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 font-medium">Etapa</th>
              <th className="py-1.5 text-right font-medium">Quantidade</th>
              <th className="py-1.5 text-right font-medium">Da etapa anterior</th>
            </tr>
          </thead>
          <tbody>
            {funil(m).map((e) => (
              <tr key={e.rotulo} className="border-b border-line/60">
                <td className="py-1.5 text-ink">{e.rotulo}</td>
                <td className="py-1.5 text-right text-ink">{fmtInteiro(e.valor)}</td>
                <td className="py-1.5 text-right text-ink">{fmtPct(e.daAnterior)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

// ── "Precisa de você agora" ──────────────────────────────────────────────────
function PrecisaAgora({ precisa }: { precisa: VisaoGeral["precisa"] | null }) {
  const itens = PRECISA.map((p) => {
    const d = precisa?.[p.chave] ?? null;
    return { ...p, n: num(d?.n), horas: num(d?.horas_mais_antigo) };
  });
  const pendentes = itens.filter((i) => (i.n ?? 0) > 0);
  return (
    <Panel title="Precisa de você agora" className="mb-6">
      {precisa && pendentes.length === 0 && <p className="mb-3 text-sm text-green-700">Nada pendente agora.</p>}
      <ul className="grid gap-2">
        {itens.map((i) => (
          <li key={i.chave}>
            <ItemPrecisa
              href={i.href}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border px-4 py-3",
                i.href && "hover:border-forest",
                (i.n ?? 0) > 0 ? "border-amber-300 bg-amber-50/60" : "border-sage-200"
              )}
            >
              <span className="min-w-0">
                <span className="block font-medium text-ink">{i.rotulo}</span>
                <span className="block text-sm text-muted">
                  {i.detalhe}
                  {(i.n ?? 0) > 0 && i.horas !== null ? ` Mais antigo: ${fmtHoras(i.horas)}.` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 font-title text-lg font-bold text-forest">
                {fmtInteiro(i.n)} {i.href && <ArrowRight className="h-4 w-4" />}
              </span>
            </ItemPrecisa>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ItemPrecisa({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
