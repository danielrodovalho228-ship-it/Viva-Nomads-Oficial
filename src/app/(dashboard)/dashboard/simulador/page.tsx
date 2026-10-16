"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Home, Download } from "lucide-react";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { useProperties } from "@/lib/use-properties";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, pctTexto, taxaPublicaTexto } from "@/lib/cobranca/regra";
import { simularRentabilidade, type EntradaRentabilidade } from "@/lib/simulador";
import { formatBRL, numBR } from "@/lib/utils";
import { NumInput, ResultCard, SimDisclaimer, SimHero } from "@/components/simulador/ui";
import { MAX_ALUGUEL_MENSAL } from "@/lib/campos-valor";
import { buttonClasses } from "@/components/ui/button";

const PRAZOS = [2, 3, 4, 6];
export default function SimuladorPage() {
  const { properties } = useProperties("/api/properties/mine");

  const [imoveisAtivos, setImoveisAtivos] = useState(1);
  const [aluguelMensal, setAluguel] = useState(3000);
  const [condoIptu, setCondoIptu] = useState(550);
  const [contas, setContas] = useState(350);
  const [mesesOcupados, setMeses] = useState(10);
  const [prazoMedioMeses, setPrazo] = useState(4);

  const entrada: EntradaRentabilidade = { aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses };
  // Regra única: taxa de serviço por contrato fechado, pela faixa do nº de imóveis ativos. Sem assinatura.
  // No Plano Gestor (31+) a taxa é negociada: o cálculo usa a da faixa anterior só como referência.
  const faixa = faixaPorImoveisAtivos(imoveisAtivos);
  const taxaTexto = taxaPublicaTexto(faixa);
  const res = useMemo(
    () => simularRentabilidade(entrada, faixa.taxa, 0),
    [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses, faixa.taxa]
  );

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
        subtitulo="Ajuste os valores e veja a receita líquida estimada, já descontada a taxa de serviço da sua faixa."
        stats={[
          { label: "Valor mensal médio mobiliado · Uberlândia", valor: "R$ 2.800–3.400" },
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
            <NumInput label="Valor mensal pretendido" value={aluguelMensal} onChange={setAluguel} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
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
              <label htmlFor="imoveis-ativos" className="mb-1 block text-sm font-medium text-ink">
                Imóveis ativos na Viva: <strong className="text-forest" data-testid="imoveis-ativos">{imoveisAtivos}</strong> · taxa de serviço{" "}
                <strong className="text-forest" data-testid="taxa-faixa">{taxaTexto}</strong> do valor total de cada contrato
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
            <ResultCard label="Receita bruta / ano" value={formatBRL(res.receitaBrutaAnual)} />
            <ResultCard label="Custos / ano" value={`− ${formatBRL(res.custosAnuais)}`} />
            <ResultCard label={`Taxa de serviço (${taxaTexto})`} value={`− ${formatBRL(res.comissaoAnual)}`} hint={`${numBR(res.contratosPorAno, 1)} contrato(s)/ano · % do valor total de cada contrato`} />
          </div>
          <div className="rounded-2xl border border-forest bg-forest p-5 text-white">
            <p className="text-sm text-white/80">Receita líquida estimada / ano</p>
            <p className="font-title text-3xl font-bold">{formatBRL(res.receitaLiquidaAnual)}</p>
            <p className="mt-1 text-sm text-white/85">
              {faixa.gestor ? (
                <>Taxa do Plano Gestor é negociada: este valor usa {pctTexto(faixa.taxa)} só como referência.</>
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
                subtitulo: `Taxa de serviço ${taxaTexto} do valor total de cada contrato`,
                entradas: [
                  { label: "Valor mensal pretendido", valor: formatBRL(aluguelMensal) },
                  { label: "Condomínio + IPTU (mês)", valor: formatBRL(condoIptu) },
                  { label: "Contas incluídas (mês)", valor: formatBRL(contas) },
                  { label: "Meses ocupados no ano", valor: String(mesesOcupados) },
                  { label: "Prazo médio por contrato", valor: `${prazoMedioMeses} meses` },
                ],
                resultados: [
                  { label: "Receita bruta / ano", valor: formatBRL(res.receitaBrutaAnual) },
                  { label: "Custos / ano", valor: `− ${formatBRL(res.custosAnuais)}` },
                  { label: `Taxa de serviço (${taxaTexto} por contrato)`, valor: `− ${formatBRL(res.comissaoAnual)}` },
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

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/dashboard/imoveis/novo" className={buttonClasses({ size: "md" })}>
          Anunciar meu imóvel
        </Link>
      </div>
    </>
  );
}
