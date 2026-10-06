"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Home, Sparkles, Download } from "lucide-react";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { useProperties } from "@/lib/use-properties";
import { PLANOS, plano as getPlano, pctDeUmAluguel, textoComissao, type PlanoId } from "@/config/planos";
import {
  simularRentabilidade,
  compararPlanos,
  recomendarPlano,
  type EntradaRentabilidade,
  type PlanoCalc,
} from "@/lib/simulador";
import { PLANO_FUNDADOR } from "@/lib/flags";
import { formatBRL, numBR } from "@/lib/utils";
import { NumInput, ResultCard, SimDisclaimer, SimHero, PlanoPills } from "@/components/simulador/ui";
import { MAX_ALUGUEL_MENSAL } from "@/lib/campos-valor";

const PRAZOS = [2, 3, 4, 6];
const PLANOS_CALC: PlanoCalc[] = PLANOS.map((p) => ({
  id: p.id,
  nome: p.nome,
  comissao: p.comissao,
  assinaturaAnual: p.assinaturaAnual,
}));

export default function SimuladorPage() {
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
  // Gestor: assinatura "sob consulta" (null) — não é grátis.
  const sobConsulta = p?.assinaturaAnual === null;
  const res = useMemo(
    () => simularRentabilidade(entrada, p?.comissao ?? 0, p?.assinaturaAnual ?? 0),
    [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses, p?.comissao, p?.assinaturaAnual]
  );
  const comparador = useMemo(() => compararPlanos(entrada, PLANOS_CALC), [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses]);
  // Recomendação honesta pelo volume real (regra 3) — pode ser o Gratuito.
  const recomendado = useMemo(() => recomendarPlano(entrada, PLANOS_CALC), [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses]);

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
            <NumInput label="Aluguel mensal pretendido" value={aluguelMensal} onChange={setAluguel} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <NumInput label="Condomínio + IPTU (mês)" value={condoIptu} onChange={setCondoIptu} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <NumInput label="Contas incluídas — água/luz/internet (mês)" value={contas} onChange={setContas} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
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
            <ResultCard label={`Comissão Viva (${textoComissao(p?.comissao ?? 0)})`} value={`− ${formatBRL(res.comissaoAnual)}`} hint={`${numBR(res.contratosPorAno, 1)} contrato(s)/ano · % do 1º aluguel`} />
            <ResultCard label="Assinatura / ano" value={sobConsulta ? "Sob consulta" : res.assinaturaAnual > 0 ? `− ${formatBRL(res.assinaturaAnual)}` : "Grátis"} />
          </div>
          <div className="rounded-2xl border border-forest bg-forest p-5 text-white">
            <p className="text-sm text-white/80">Receita líquida estimada / ano</p>
            <p className="font-title text-3xl font-bold">{formatBRL(res.receitaLiquidaAnual)}</p>
            <p className="mt-1 text-sm text-white/85">
              {sobConsulta ? (
                <>Antes da assinatura do plano Gestor (sob consulta) — o valor final depende dela.</>
              ) : (
                <>Média de <strong>{formatBRL(res.mediaMensal)}/mês</strong> no bolso.</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              imprimirSimulacao({
                titulo: "Simulação de rentabilidade",
                subtitulo: `Plano ${p?.nome ?? "—"}`,
                entradas: [
                  { label: "Aluguel mensal pretendido", valor: formatBRL(aluguelMensal) },
                  { label: "Condomínio + IPTU (mês)", valor: formatBRL(condoIptu) },
                  { label: "Contas incluídas (mês)", valor: formatBRL(contas) },
                  { label: "Meses ocupados no ano", valor: String(mesesOcupados) },
                  { label: "Prazo médio por contrato", valor: `${prazoMedioMeses} meses` },
                ],
                resultados: [
                  { label: "Receita bruta / ano", valor: formatBRL(res.receitaBrutaAnual) },
                  { label: "Custos / ano", valor: `− ${formatBRL(res.custosAnuais)}` },
                  { label: `Comissão Viva (${pctDeUmAluguel(p?.comissao ?? 0)} por contrato)`, valor: `− ${formatBRL(res.comissaoAnual)}` },
                  { label: "Assinatura / ano", valor: sobConsulta ? "Sob consulta" : res.assinaturaAnual > 0 ? `− ${formatBRL(res.assinaturaAnual)}` : "Grátis" },
                  { label: "Receita líquida / ano", valor: formatBRL(res.receitaLiquidaAnual) },
                  { label: "Média mensal no bolso", valor: `${formatBRL(res.mediaMensal)}/mês` },
                ],
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest hover:border-sage"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
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
              comissão do Profissional no fechamento: <strong>{textoComissao(getPlano("pro")!.comissao, aluguelMensal)}</strong>.
            </span>
          </p>
        )}

        {recomendado && (
          <p
            data-testid="plano-recomendado"
            className="mt-4 flex items-start gap-2 rounded-xl border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-ink"
          >
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            <span>
              <strong>Recomendado para você: {recomendado.nome}.</strong> {recomendado.motivo} A
              gente diz na lata — mesmo quando o melhor plano é o Gratuito.
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
                  <td className="py-2.5 pr-4 text-ink">{pctDeUmAluguel(l.comissaoPct)} por contrato</td>
                  <td className="py-2.5 pr-4 text-ink">{l.sobConsulta ? "Sob consulta" : l.assinaturaAnual === 0 ? "Grátis" : formatBRL(l.assinaturaAnual)}</td>
                  {/* Assinatura "sob consulta" não é R$ 0: sem o valor, o total fica em aberto. */}
                  <td className="py-2.5 pr-4 text-ink">{l.sobConsulta ? "—" : formatBRL(l.totalVivaAnual)}</td>
                  <td className="py-2.5 pr-4 font-semibold text-forest">{l.sobConsulta ? "Sob consulta" : formatBRL(l.liquidoProprietario)}</td>
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
