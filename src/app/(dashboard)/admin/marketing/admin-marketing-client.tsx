"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { CANAIS_MARKETING, canalLabel, gastosCsv, totaisPorMes, type GastoMarketing } from "@/lib/marketing";
import { lancarGastoMarketing, apagarGastoMarketing } from "@/lib/data/marketing-admin";

function mesLabel(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function mesAtual(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
}

/**
 * Gastos de marketing por mês e canal — base do CAC e do ROI (painel
 * financeiro). Lançamento simples; corrigir = apagar e lançar de novo.
 */
export function AdminMarketingClient({ gastos, aviso }: { gastos: GastoMarketing[]; aviso: string | null }) {
  const router = useRouter();
  const [mes, setMes] = useState(mesAtual());
  const [canal, setCanal] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const totais = totaisPorMes(gastos);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await lancarGastoMarketing({ mes, canal, valor, observacao });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error ?? "Não foi possível lançar.");
      return;
    }
    setValor("");
    setObservacao("");
    router.refresh();
  }

  async function apagar(id: string) {
    if (!window.confirm("Apagar este lançamento?")) return;
    setApagando(id);
    const r = await apagarGastoMarketing(id);
    setApagando(null);
    if (!r.ok) setErro(r.error ?? "Não foi possível apagar.");
    else router.refresh();
  }

  function baixarCsv() {
    const blob = new Blob(["﻿" + gastosCsv(gastos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-marketing-${mesAtual()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const campo = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";

  return (
    <>
      <PageTitle title="Gastos de marketing" subtitle="Quanto foi investido por mês e canal. É a base do CAC e do ROI." />

      {aviso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>
      )}

      <Panel title="Novo lançamento" className="mb-6">
        <form onSubmit={lancar} className="grid gap-3 sm:grid-cols-[10rem_10rem_10rem_1fr_auto] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Mês</span>
            <input type="month" required value={mes} onChange={(e) => setMes(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Canal</span>
            <select required value={canal} onChange={(e) => setCanal(e.target.value)} className={campo}>
              <option value="">Escolha</option>
              {CANAIS_MARKETING.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Valor (R$)</span>
            <input
              inputMode="decimal"
              required
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={campo}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Observação (opcional)</span>
            <input
              maxLength={500}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className={campo}
            />
          </label>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Salvando..." : "Lançar"}
          </Button>
        </form>
        {erro && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erro}
          </p>
        )}
      </Panel>

      <Panel title="Total por mês" className="mb-6">
        {totais.length === 0 ? (
          <p className="text-sm text-muted">— sem dados no período</p>
        ) : (
          <ul className="divide-y divide-line">
            {totais.map((t) => (
              <li key={t.mes} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize text-ink">{mesLabel(t.mes)}</span>
                <span className="font-medium text-ink">{formatBRL(t.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Lançamentos">
        {gastos.length === 0 ? (
          <p className="text-sm text-muted">— sem dados no período</p>
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={baixarCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-ink hover:border-forest"
              >
                <Download className="h-4 w-4" /> Baixar CSV
              </button>
            </div>
            <ul className="divide-y divide-line">
              {gastos.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block text-ink">
                      <span className="capitalize">{mesLabel(g.mes)}</span> · {canalLabel(g.canal)}
                    </span>
                    {g.observacao && <span className="block truncate text-muted">{g.observacao}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-medium text-ink">{formatBRL(g.valor)}</span>
                    <button
                      type="button"
                      onClick={() => apagar(g.id)}
                      disabled={apagando === g.id}
                      aria-label={`Apagar lançamento de ${canalLabel(g.canal)} em ${mesLabel(g.mes)}`}
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
