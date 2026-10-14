"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Percent, Info, Download } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, pctTexto } from "@/lib/cobranca/regra";
import { COMPARE_RODAPE, RETORNO_AIRBNB_UBERLANDIA, linhasPublicas } from "@/config/compare-precos";
import { simularROI, type EntradaROI } from "@/lib/simulador";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { formatBRL, numBR } from "@/lib/utils";
import { MAX_ALUGUEL_MENSAL, MAX_INVESTIMENTO } from "@/lib/campos-valor";
import { NumInput, ResultCard, SimDisclaimer, SimHero } from "@/components/simulador/ui";
import { buttonClasses } from "@/components/ui/button";

const INCLUI =
  "Móveis dos quartos e sala, cozinha equipada, eletrodomésticos, cama/colchão, mesa de trabalho, cortinas e utensílios.";

export default function RoiImovelPage() {
  const [imoveisAtivos, setImoveisAtivos] = useState(1);
  const [investimentoMobiliar, setInvest] = useState(25000);
  const [aluguelVazio, setVazio] = useState(1800);
  const [aluguelMobiliado, setMob] = useState(3000);
  const [mesesOcupados, setMeses] = useState(10);
  const [contasMensais, setContas] = useState(400);
  const [reposicaoPct, setReposicao] = useState(10);

  const entrada: EntradaROI = {
    investimentoMobiliar,
    aluguelVazio,
    aluguelMobiliado,
    mesesOcupados,
    prazoMedioMeses: 4,
    contasMensais,
    reposicaoAnualPct: reposicaoPct / 100,
  };
  // Regra única: taxa de serviço por contrato fechado, pela faixa do nº de imóveis ativos. Sem assinatura nesta fase.
  const faixa = faixaPorImoveisAtivos(imoveisAtivos);
  const res = useMemo(
    () => simularROI(entrada, faixa.taxa, 0),
    [investimentoMobiliar, aluguelVazio, aluguelMobiliado, mesesOcupados, contasMensais, reposicaoPct, faixa.taxa]
  );
  const comparativo = linhasPublicas().filter((l) => l.pct !== null);

  // Textos dos resultados (prêmio com sinal; payback/ROI sem investimento).
  const premioTexto = `${res.premioMensal >= 0 ? "+ " : "− "}${formatBRL(Math.abs(res.premioMensal))}/mês`;
  const premioDica =
    res.premioMensal >= 0
      ? `${Math.round(res.premioPct * 100)}% acima do vazio`
      : `${Math.round(Math.abs(res.premioPct) * 100)}% abaixo do vazio`;
  const paybackTexto =
    res.paybackMeses === null ? "—" : res.paybackMeses === 0 ? "Imediato" : `${res.paybackMeses} meses`;
  const paybackDica =
    res.paybackMeses === null
      ? "o mobiliado não rende mais que o vazio"
      : res.paybackMeses === 0
        ? "sem investimento a recuperar"
        : `≈ ${numBR(res.paybackMeses / 12, 1)} anos`;
  const roiTexto = res.roiAnual === null ? "—" : `${Math.round(res.roiAnual * 100)}%`;

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
              <NumInput label="Investimento para mobiliar" value={investimentoMobiliar} onChange={setInvest} step={1000} prefix="R$" max={MAX_INVESTIMENTO} />
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {INCLUI}
              </p>
            </div>
            <NumInput label="Aluguel VAZIO de referência (mês)" value={aluguelVazio} onChange={setVazio} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <NumInput label="Aluguel MOBILIADO pretendido (mês)" value={aluguelMobiliado} onChange={setMob} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <NumInput label="Contas incluídas no mobiliado (água, luz, internet) por mês" value={contasMensais} onChange={setContas} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <NumInput label="Reposição e desgaste da mobília (% do investimento por ano)" value={reposicaoPct} onChange={setReposicao} step={1} max={100} />
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Meses ocupados no ano (mobiliado): <strong className="text-forest">{mesesOcupados}</strong>
              </label>
              <input type="range" min={6} max={12} value={mesesOcupados} onChange={(e) => setMeses(Number(e.target.value))} className="w-full accent-forest" />
            </div>
            <div>
              <label htmlFor="imoveis-ativos" className="mb-1 block text-sm font-medium text-ink">
                Imóveis ativos na Viva: <strong className="text-forest">{imoveisAtivos}</strong> · taxa de serviço{" "}
                <strong className="text-forest">{pctTexto(faixa.taxa)}</strong> do valor total de cada contrato
              </label>
              <input
                id="imoveis-ativos"
                type="range"
                min={1}
                max={FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1].minImoveis}
                value={imoveisAtivos}
                onChange={(e) => setImoveisAtivos(Number(e.target.value))}
                className="w-full accent-forest"
              />
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ResultCard label="Prêmio do mobiliado" value={premioTexto} hint={premioDica} />
            <ResultCard
              label="Ganho líquido adicional / ano"
              value={formatBRL(res.ganhoAdicionalAnual)}
              hint="já descontando a taxa de serviço, contas e reposição"
            />
            <ResultCard label="Payback do investimento" value={paybackTexto} hint={paybackDica} />
            <ResultCard label="ROI anual" value={roiTexto} hint={res.roiAnual === null ? "sem investimento para comparar" : undefined} />
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

          <button
            type="button"
            onClick={() =>
              imprimirSimulacao({
                titulo: "Calculadora de ROI — mobiliar o imóvel",
                subtitulo: `Taxa de serviço ${pctTexto(faixa.taxa)} do valor total de cada contrato`,
                entradas: [
                  { label: "Investimento para mobiliar", valor: formatBRL(investimentoMobiliar) },
                  { label: "Aluguel vazio (mês)", valor: formatBRL(aluguelVazio) },
                  { label: "Aluguel mobiliado (mês)", valor: formatBRL(aluguelMobiliado) },
                  { label: "Meses ocupados no ano", valor: String(mesesOcupados) },
                ],
                resultados: [
                  { label: "Prêmio do mobiliado", valor: premioTexto },
                  { label: "Ganho líquido adicional / ano", valor: formatBRL(res.ganhoAdicionalAnual) },
                  { label: "Payback do investimento", valor: paybackTexto },
                  { label: "ROI anual", valor: roiTexto },
                ],
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest hover:border-sage"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
        </div>
      </div>

      <section aria-labelledby="comparar-canais" className="mt-6 rounded-2xl border border-sage-200 bg-white p-5">
        <h2 id="comparar-canais" className="font-title text-lg font-bold text-ink">
          Quanto fica de cada mês em cada canal
        </h2>
        <p className="mt-1 text-xs text-muted">Percentual do total pago pelo morador que o canal retém, em média.</p>
        <ul className="mt-3 space-y-2">
          {comparativo.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-ink">
                <strong>{l.nome}</strong> <span className="text-muted">— {l.regra}</span>
              </span>
              <span className="shrink-0 font-semibold text-forest">≈ {numBR((l.pct ?? 0) * 100, 1)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{RETORNO_AIRBNB_UBERLANDIA.texto}</p>
        <p className="mt-2 text-[11px] text-muted">
          Fontes: {comparativo.filter((l) => l.fonte).map((l) => l.fonte?.nome).join("; ")}; {RETORNO_AIRBNB_UBERLANDIA.fonte}. {COMPARE_RODAPE}
        </p>
      </section>

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/dashboard/imoveis/novo" className={buttonClasses({ size: "md" })}>
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
