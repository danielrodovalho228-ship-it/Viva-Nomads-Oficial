"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Percent, Info } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { plano as getPlano, type PlanoId } from "@/config/planos";
import { simularROI, type EntradaROI } from "@/lib/simulador";
import { formatBRL } from "@/lib/utils";
import { NumInput, ResultCard, SimDisclaimer, SimHero, PlanoPills } from "@/components/simulador/ui";

const INCLUI =
  "Móveis dos quartos e sala, cozinha equipada, eletrodomésticos, cama/colchão, mesa de trabalho, cortinas e utensílios.";

export default function RoiImovelPage() {
  const user = useAuthStore((s) => s.user);
  const planoAtivo = ((user ?? DEMO_USER).plan ?? "free") as PlanoId;

  const [planoId, setPlanoId] = useState<PlanoId>(planoAtivo);
  const [investimentoMobiliar, setInvest] = useState(25000);
  const [aluguelVazio, setVazio] = useState(1800);
  const [aluguelMobiliado, setMob] = useState(3000);
  const [mesesOcupados, setMeses] = useState(10);

  const entrada: EntradaROI = { investimentoMobiliar, aluguelVazio, aluguelMobiliado, mesesOcupados, prazoMedioMeses: 4 };
  const p = getPlano(planoId);
  const res = useMemo(
    () => simularROI(entrada, p?.comissao ?? 0, p?.assinaturaAnual ?? 0),
    [investimentoMobiliar, aluguelVazio, aluguelMobiliado, mesesOcupados, p?.comissao, p?.assinaturaAnual]
  );

  const maxAbs = Math.max(1, ...res.acumulado.flatMap((a) => [Math.abs(a.mobiliado), Math.abs(a.vazio)]));

  return (
    <>
      <PageTitle title="Calculadora de ROI" subtitle="Vale a pena mobiliar o seu imóvel para média duração?" />

      <SimHero
        icon={Percent}
        titulo="Vale a pena mobiliar?"
        subtitulo="Compare o aluguel vazio × mobiliado e descubra em quanto tempo o investimento se paga."
        stats={[
          { label: "Prêmio típico do mobiliado", valor: "+40–70%" },
          { label: "Investimento p/ mobiliar", valor: "R$ 15–35 mil" },
          { label: "Payback comum", valor: "2–4 anos" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <div className="rounded-2xl border border-sage-200 bg-white p-5">
          <h2 className="font-title text-lg font-bold text-ink">Seus números</h2>
          <div className="mt-4 space-y-4">
            <div>
              <NumInput label="Investimento para mobiliar" value={investimentoMobiliar} onChange={setInvest} step={1000} prefix="R$" />
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {INCLUI}
              </p>
            </div>
            <NumInput label="Aluguel VAZIO de referência (mês)" value={aluguelVazio} onChange={setVazio} step={100} prefix="R$" />
            <NumInput label="Aluguel MOBILIADO pretendido (mês)" value={aluguelMobiliado} onChange={setMob} step={100} prefix="R$" />
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Meses ocupados no ano (mobiliado): <strong className="text-forest">{mesesOcupados}</strong>
              </label>
              <input type="range" min={6} max={12} value={mesesOcupados} onChange={(e) => setMeses(Number(e.target.value))} className="w-full accent-forest" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-ink">Simular no plano</p>
              <PlanoPills value={planoId} onChange={(v) => setPlanoId(v as PlanoId)} />
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ResultCard label="Prêmio do mobiliado" value={`+ ${formatBRL(res.premioMensal)}/mês`} hint={`${Math.round(res.premioPct * 100)}% acima do vazio`} />
            <ResultCard label="Ganho líquido adicional / ano" value={formatBRL(res.ganhoAdicionalAnual)} hint="já descontando comissão e assinatura" />
            <ResultCard label="Payback do investimento" value={res.paybackMeses ? `${res.paybackMeses} meses` : "—"} hint={res.paybackMeses ? `≈ ${(res.paybackMeses / 12).toFixed(1)} anos` : "sem ganho adicional"} />
            <ResultCard label="ROI anual" value={`${Math.round(res.roiAnual * 100)}%`} />
          </div>

          {/* Gráfico simples: acumulado ano 1-2-3 mobiliado × vazio */}
          <div className="rounded-2xl border border-sage-200 bg-white p-5">
            <p className="text-sm font-medium text-ink">Acumulado — mobiliado × vazio</p>
            <div className="mt-4 space-y-3">
              {res.acumulado.map((a) => (
                <div key={a.ano}>
                  <p className="mb-1 text-xs text-muted">Ano {a.ano}</p>
                  <Barra label="Mobiliado" valor={a.mobiliado} max={maxAbs} tone="forest" />
                  <Barra label="Vazio" valor={a.vazio} max={maxAbs} tone="sage" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted">O mobiliado desconta o investimento no ano 1 — por isso pode começar atrás e ultrapassar depois.</p>
          </div>
        </div>
      </div>

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/qualificar" className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-forest/90">
          Anunciar meu imóvel
        </Link>
      </div>
    </>
  );
}

function Barra({ label, valor, max, tone }: { label: string; valor: number; max: number; tone: "forest" | "sage" }) {
  const pct = Math.min(100, (Math.abs(valor) / max) * 100);
  const cor = tone === "forest" ? "bg-forest" : "bg-sage";
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${cor} ${valor < 0 ? "opacity-40" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-medium text-ink">{formatBRL(valor)}</span>
    </div>
  );
}
