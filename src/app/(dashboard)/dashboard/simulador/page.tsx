"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Home, Sparkles } from "lucide-react";
import { PageTitle, EmConstrucao } from "@/components/dashboard/primitives";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { useProperties } from "@/lib/use-properties";
import { PLANOS, plano as getPlano, type PlanoId } from "@/config/planos";
import {
  simularRentabilidade,
  compararPlanos,
  type EntradaRentabilidade,
  type PlanoCalc,
} from "@/lib/simulador";
import { PLANO_FUNDADOR, FERRAMENTAS_REAIS } from "@/lib/flags";
import { formatBRL } from "@/lib/utils";
import { NumInput, ResultCard, SimDisclaimer, SimHero, PlanoPills } from "@/components/simulador/ui";

const PRAZOS = [2, 3, 4, 6];
const PLANOS_CALC: PlanoCalc[] = PLANOS.map((p) => ({
  id: p.id,
  nome: p.nome,
  comissao: p.comissao,
  assinaturaAnual: p.assinaturaAnual,
}));

export default function SimuladorPage() {
  // Ferramenta EM DESENVOLVIMENTO: enquanto a flag está OFF, o card do hub abre
  // o placeholder padrão dentro da casca. A implementação real fica preservada
  // abaixo (SimuladorReal), atrás da flag (B2).
  if (!FERRAMENTAS_REAIS) {
    return (
      <EmConstrucao
        title="Simulador de rentabilidade"
        text="A calculadora de rentabilidade do seu imóvel está em desenvolvimento e chega em breve, aqui no seu painel."
      />
    );
  }
  return <SimuladorReal />;
}

function SimuladorReal() {
  const user = useAuthStore((s) => s.user);
  const planoAtivo = ((user ?? DEMO_USER).plan ?? "free") as PlanoId;
  const { properties } = useProperties("/api/properties/mine");

  const [planoId, setPlanoId] = useState<PlanoId>(planoAtivo);
  const [aluguelMensal, setAluguel] = useState(3000);
  const [condoIptu, setCondoIptu] = useState(550);
  const [contas, setContas] = useState(350);
  const [mesesOcupados, setMeses] = useState(10);
  const [prazoMedioMeses, setPrazo] = useState(4);

  const entrada: EntradaRentabilidade = { aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses };
  const p = getPlano(planoId);
  const res = useMemo(
    () => simularRentabilidade(entrada, p?.comissao ?? 0, p?.assinaturaAnual ?? 0),
    [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses, p?.comissao, p?.assinaturaAnual]
  );
  const comparador = useMemo(() => compararPlanos(entrada, PLANOS_CALC), [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses]);

  function usarMeuImovel() {
    const im = properties[0];
    if (!im) return;
    setAluguel(Math.round(im.monthlyPrice) || 3000);
    if (im.condoFee) setCondoIptu(Math.round(im.condoFee));
    if (im.utilitiesEstimate) setContas(Math.round(im.utilitiesEstimate));
  }

  return (
    <>
      <PageTitle title="Simulador de rentabilidade" subtitle="Quanto o seu imóvel rende por mês na Viva Nomads." />

      <SimHero
        icon={TrendingUp}
        titulo="Simule a rentabilidade do seu imóvel"
        subtitulo="Ajuste os valores e veja a receita líquida estimada — e quanto você pagaria em cada plano."
        stats={[
          { label: "Aluguel médio mobiliado · Uberlândia", valor: "R$ 2.800–3.400" },
          { label: "Prazo médio de estadia", valor: "3–4 meses" },
          { label: "Ocupação típica", valor: "~10 meses/ano" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <div className="rounded-2xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-title text-lg font-bold text-ink">Seus números</h2>
            {properties.length > 0 && (
              <button
                type="button"
                onClick={usarMeuImovel}
                className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 px-3 py-1.5 text-xs font-medium text-forest hover:border-sage"
              >
                <Home className="h-3.5 w-3.5" /> Usar dados do meu imóvel
              </button>
            )}
          </div>
          <div className="mt-4 space-y-4">
            <NumInput label="Aluguel mensal pretendido" value={aluguelMensal} onChange={setAluguel} step={100} prefix="R$" />
            <NumInput label="Condomínio + IPTU (mês)" value={condoIptu} onChange={setCondoIptu} step={50} prefix="R$" />
            <NumInput label="Contas incluídas — água/luz/internet (mês)" value={contas} onChange={setContas} step={50} prefix="R$" />
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Meses ocupados no ano: <strong className="text-forest">{mesesOcupados}</strong>
              </label>
              <input type="range" min={6} max={12} value={mesesOcupados} onChange={(e) => setMeses(Number(e.target.value))} className="w-full accent-forest" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-ink">Prazo médio por contrato</p>
              <div className="flex flex-wrap gap-2">
                {PRAZOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPrazo(m)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${prazoMedioMeses === m ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
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
            <ResultCard label="Receita bruta / ano" value={formatBRL(res.receitaBrutaAnual)} />
            <ResultCard label="Custos / ano" value={`− ${formatBRL(res.custosAnuais)}`} />
            <ResultCard label={`Comissão Viva (${Math.round((p?.comissao ?? 0) * 100)}%)`} value={`− ${formatBRL(res.comissaoAnual)}`} hint={`${res.contratosPorAno.toFixed(1)} contrato(s)/ano · % do 1º aluguel`} />
            <ResultCard label="Assinatura / ano" value={res.assinaturaAnual > 0 ? `− ${formatBRL(res.assinaturaAnual)}` : "Grátis"} />
          </div>
          <div className="rounded-2xl border border-forest bg-forest p-5 text-white">
            <p className="text-sm text-white/80">Receita líquida estimada / ano</p>
            <p className="font-title text-3xl font-bold">{formatBRL(res.receitaLiquidaAnual)}</p>
            <p className="mt-1 text-sm text-white/85">Média de <strong>{formatBRL(res.mediaMensal)}/mês</strong> no bolso.</p>
          </div>
        </div>
      </div>

      {/* Comparador de planos */}
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-ink">Compare os planos com os mesmos números</h2>
        <p className="text-sm text-muted">Assinatura, comissão e o que sobra para você em cada plano.</p>

        {PLANO_FUNDADOR && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-champagne bg-champagne/15 px-4 py-3 text-sm text-ink">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" />
            <span>
              <strong>Piloto Fundador:</strong> no piloto a assinatura é <strong>R$ 0</strong> — você só paga a
              comissão de <strong>8%</strong> (trilha Profissional) no fechamento.
            </span>
          </p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-sage-200 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Plano</th>
                <th className="py-2 pr-4 font-medium">Comissão</th>
                <th className="py-2 pr-4 font-medium">Assinatura/ano</th>
                <th className="py-2 pr-4 font-medium">Total à Viva/ano</th>
                <th className="py-2 pr-4 font-medium">Você recebe/ano</th>
              </tr>
            </thead>
            <tbody>
              {comparador.map((l) => (
                <tr key={l.planoId} className={`border-b border-sage-100 ${l.planoId === planoId ? "bg-sage-50" : ""}`}>
                  <td className="py-2.5 pr-4 font-medium text-ink">{l.nome}</td>
                  <td className="py-2.5 pr-4 text-ink">{Math.round(l.comissaoPct * 100)}%</td>
                  <td className="py-2.5 pr-4 text-ink">{l.sobConsulta ? "Sob consulta" : l.assinaturaAnual === 0 ? "Grátis" : formatBRL(l.assinaturaAnual)}</td>
                  <td className="py-2.5 pr-4 text-ink">{formatBRL(l.totalVivaAnual)}</td>
                  <td className="py-2.5 pr-4 font-semibold text-forest">{formatBRL(l.liquidoProprietario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/qualificar" className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-forest/90">
          Anunciar meu imóvel
        </Link>
      </div>
    </>
  );
}
