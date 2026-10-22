"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Home, Download } from "lucide-react";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { useProperties } from "@/lib/use-properties";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, pctTexto, rotuloTaxaServico, taxaPublicaTexto } from "@/lib/cobranca/regra";
import { cenariosOcupacao, simularRentabilidade, type Cobranca, type EntradaRentabilidade } from "@/lib/simulador";
import { formatBRL, numBR } from "@/lib/utils";
import { BarraValor, CobrancaToggle, ComoCalculamos, NumInput, ResultCard, SimDisclaimer, SimHero } from "@/components/simulador/ui";
import { MAX_ALUGUEL_MENSAL, MAX_INVESTIMENTO } from "@/lib/campos-valor";
import { buttonClasses } from "@/components/ui/button";

const PRAZOS = [2, 3, 4, 6];

/** Fórmulas da tela, em texto simples (prompt 15). A mesma função do mobiliado na Calculadora de ROI: liquidoMobiliadoAnual. */
const COMO_CALCULAMOS = [
  "Receita bruta do ano = valor mensal × meses ocupados.",
  "Taxa de serviço = taxa da sua faixa sobre o valor mensal × meses ocupados. Ela nunca incide sobre condomínio, IPTU ou contas cobrados à parte, nem sobre limpeza ou taxa pet.",
  "Condomínio + IPTU cobrados à parte: o morador paga junto com o valor mensal nos meses ocupados; você paga só nos meses vazios. Incluídos no valor mensal: você paga os 12 meses.",
  "Contas de consumo cobradas à parte: o morador paga. Incluídas no valor mensal: você paga nos meses ocupados.",
  "Reposição e desgaste da mobília = investimento na mobília × % ao ano (o mesmo campo da Calculadora de ROI). Use 0 para não considerar.",
  "Receita líquida = receita bruta − custos − taxa de serviço − reposição da mobília. A média mensal é a líquida do ano dividida por 12. É a mesma conta do mobiliado na Calculadora de ROI.",
  "Rentabilidade sobre o imóvel = receita líquida do ano ÷ valor do imóvel (só aparece se você informar o valor).",
  "Cenários: a mesma conta com 2 meses ocupados a menos e 2 a mais que o seu número, entre 6 e 12 meses.",
];

export default function SimuladorPage() {
  const { properties } = useProperties("/api/properties/mine");

  const [imoveisAtivos, setImoveisAtivos] = useState(1);
  const [aluguelMensal, setAluguel] = useState(3000);
  const [condoIptu, setCondoIptu] = useState(550);
  const [contas, setContas] = useState(350);
  const [condoCobranca, setCondoCobranca] = useState<Cobranca>("aparte");
  const [contasCobranca, setContasCobranca] = useState<Cobranca>("aparte");
  const [valorImovel, setValorImovel] = useState(0);
  const [mesesOcupados, setMeses] = useState(10);
  const [prazoMedioMeses, setPrazo] = useState(4);
  // Padrão R$ 0: sem inventar custo de mobília; quem informa o investimento vê a reposição (a mesma conta do ROI).
  const [investimentoMobilia, setInvest] = useState(0);
  const [reposicaoPct, setReposicao] = useState(10);

  const entrada: EntradaRentabilidade = {
    aluguelMensal,
    condoIptu,
    contas,
    mesesOcupados,
    prazoMedioMeses,
    condoCobranca,
    contasCobranca,
    valorImovel,
    investimentoMobilia,
    reposicaoAnualPct: reposicaoPct / 100,
  };
  // Regra única: taxa de serviço por contrato fechado, pela faixa do nº de imóveis ativos. Sem assinatura.
  // No Plano Gestor (31+) a taxa é negociada: o cálculo usa a da faixa anterior só como referência.
  const faixa = faixaPorImoveisAtivos(imoveisAtivos);
  const taxaTexto = taxaPublicaTexto(faixa);
  const res = useMemo(
    () => simularRentabilidade(entrada, faixa.taxa, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `entrada` é recriada a cada render; os campos dela estão aqui
    [aluguelMensal, condoIptu, contas, mesesOcupados, prazoMedioMeses, condoCobranca, contasCobranca, valorImovel, investimentoMobilia, reposicaoPct, faixa.taxa]
  );
  const cenarios = cenariosOcupacao(mesesOcupados).map((c) => ({
    ...c,
    liquida: simularRentabilidade({ ...entrada, mesesOcupados: c.mesesOcupados }, faixa.taxa, 0).receitaLiquidaAnual,
  }));
  const maxBarra = Math.max(1, res.receitaBrutaAnual);

  function usarMeuImovel() {
    const im = properties[0];
    if (!im) return;
    setAluguel(Math.round(im.monthlyPrice) || 3000);
    if (im.condoFee) setCondoIptu(Math.round(im.condoFee));
    if (im.utilitiesEstimate) setContas(Math.round(im.utilitiesEstimate));
  }

  return (
    <>
      <PageTitle capa="simulador" title="Simulador de rentabilidade" subtitle="Quanto o seu imóvel rende por mês na Viva Nomads." />

      <SimHero
        icon={TrendingUp}
        titulo="Simule a rentabilidade do seu imóvel"
        subtitulo="Ajuste os valores e veja a receita líquida estimada, já descontada a taxa de serviço da sua faixa."
        stats={[
          { label: "Taxa de serviço da sua faixa", valor: taxaTexto },
          { label: "Média mensal no bolso (sua simulação)", valor: formatBRL(res.mediaMensal) },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-title text-lg font-semibold text-ink">Seus números</h2>
            {properties.length > 0 && (
              <button
                type="button"
                onClick={usarMeuImovel}
                className="inline-flex items-center gap-2 rounded-full border border-sage-200 px-3 py-2 text-xs font-medium text-forest hover:border-sage"
              >
                <Home className="h-3.5 w-3.5" /> Usar dados do meu imóvel
              </button>
            )}
          </div>
          <div className="mt-4 space-y-4">
            <NumInput label="Valor mensal pretendido" value={aluguelMensal} onChange={setAluguel} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
            <div>
              <NumInput label="Condomínio + IPTU (mês)" value={condoIptu} onChange={setCondoIptu} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
              <CobrancaToggle rotulo="Como o condomínio + IPTU chega ao morador" value={condoCobranca} onChange={setCondoCobranca} testid="cobranca-condo" />
            </div>
            <div>
              <NumInput label="Contas de consumo — água, luz, internet (mês)" value={contas} onChange={setContas} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
              <CobrancaToggle rotulo="Como as contas chegam ao morador" value={contasCobranca} onChange={setContasCobranca} testid="cobranca-contas" />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0" data-testid="sim-reposicao">
              <NumInput label="Investimento na mobília" value={investimentoMobilia} onChange={setInvest} step={1000} prefix="R$" max={MAX_INVESTIMENTO} />
              <NumInput label="Reposição e desgaste da mobília (% do investimento por ano)" value={reposicaoPct} onChange={setReposicao} step={1} max={100} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Meses ocupados no ano: <strong className="text-forest">{mesesOcupados}</strong>
              </label>
              <input
                type="range"
                min={6}
                max={12}
                value={mesesOcupados}
                onChange={(e) => setMeses(Number(e.target.value))}
                className="w-full accent-forest"
                aria-label="Meses ocupados no ano"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-ink">Prazo médio por contrato</p>
              <div className="flex flex-wrap gap-2">
                {PRAZOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPrazo(m)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${prazoMedioMeses === m ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
            </div>
            <div>
              <NumInput label="Valor do imóvel (opcional)" value={valorImovel} onChange={setValorImovel} step={10000} prefix="R$" max={MAX_INVESTIMENTO * 10} />
              <p className="mt-1 text-xs text-muted">Para ver a rentabilidade sobre o valor do imóvel. Deixe 0 se não quiser.</p>
            </div>
            <div>
              <label htmlFor="imoveis-ativos" className="mb-1 block text-sm font-medium text-ink">
                Imóveis ativos na Viva: <strong className="text-forest" data-testid="imoveis-ativos">{imoveisAtivos}</strong> · taxa de serviço{" "}
                <strong className="text-forest" data-testid="taxa-faixa">{taxaTexto}</strong> sobre o valor mensal × meses de cada contrato
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
            <ResultCard
              label="Custos / ano"
              value={`− ${formatBRL(res.custosAnuais)}`}
              hint={condoCobranca === "aparte" && contasCobranca === "aparte" ? "condomínio só nos meses vazios" : undefined}
            />
            <ResultCard label={`Taxa de serviço (${taxaTexto})`} value={`− ${formatBRL(res.comissaoAnual)}`} hint={`${numBR(res.contratosPorAno, 1)} contrato(s)/ano`} />
            <ResultCard label="Reposição e desgaste da mobília / ano" value={`− ${formatBRL(res.reposicaoAnual)}`} hint={`${numBR(reposicaoPct, 1)}% de ${formatBRL(investimentoMobilia)}`} />
          </div>
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted" data-testid="sim-taxa-rotulo">
            {rotuloTaxaServico(faixa.taxa, aluguelMensal, mesesOcupados, res.comissaoAnual)} no ano.
          </p>
          <div className="rounded-xl border border-forest bg-forest p-5 text-white" data-testid="sim-liquida">
            <p className="text-sm text-white/80">Receita líquida estimada / ano</p>
            <p className="font-title text-2xl font-semibold">{formatBRL(res.receitaLiquidaAnual)}</p>
            <p className="mt-1 text-sm text-white/85">
              {faixa.gestor ? (
                <>Taxa do Plano Gestor é negociada: este valor usa {pctTexto(faixa.taxa)} só como referência.</>
              ) : (
                <>Média de <strong>{formatBRL(res.mediaMensal)}/mês</strong> no bolso.</>
              )}
            </p>
            {res.rentabilidadeImovel !== null && (
              <p className="mt-2 border-t border-white/20 pt-2 text-sm text-white/90" data-testid="sim-rentabilidade-imovel">
                Rentabilidade sobre o valor do imóvel: <strong>{numBR(res.rentabilidadeImovel * 100, 1)}% ao ano</strong> (
                {numBR((res.rentabilidadeImovel * 100) / 12, 2)}% ao mês)
              </p>
            )}
          </div>

          {/* Gráfico: para onde vai a receita do ano. */}
          <div className="rounded-xl border border-sage-200 bg-white p-5" data-testid="sim-grafico">
            <p className="text-sm font-medium text-ink">Para onde vai a receita do ano</p>
            <div className="mt-3 space-y-2">
              <BarraValor label="Receita bruta" valor={res.receitaBrutaAnual} max={maxBarra} tone="sage" formatar={formatBRL} />
              <BarraValor label="Custos" valor={-res.custosAnuais} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
              <BarraValor label="Taxa de serviço" valor={-res.comissaoAnual} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
              <BarraValor label="Reposição" valor={-res.reposicaoAnual} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
              <BarraValor label="Líquida" valor={res.receitaLiquidaAnual} max={maxBarra} tone="forest" formatar={formatBRL} />
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              imprimirSimulacao({
                titulo: "Simulação de rentabilidade",
                subtitulo: rotuloTaxaServico(faixa.taxa, aluguelMensal, mesesOcupados, res.comissaoAnual),
                entradas: [
                  { label: "Valor mensal pretendido", valor: formatBRL(aluguelMensal) },
                  { label: "Condomínio + IPTU (mês)", valor: `${formatBRL(condoIptu)} · ${condoCobranca === "aparte" ? "cobrado à parte" : "incluído"}` },
                  { label: "Contas de consumo (mês)", valor: `${formatBRL(contas)} · ${contasCobranca === "aparte" ? "cobradas à parte" : "incluídas"}` },
                  { label: "Meses ocupados no ano", valor: String(mesesOcupados) },
                  { label: "Prazo médio por contrato", valor: `${prazoMedioMeses} meses` },
                  { label: "Reposição e desgaste da mobília", valor: `${numBR(reposicaoPct, 1)}% de ${formatBRL(investimentoMobilia)} por ano` },
                ],
                resultados: [
                  { label: "Receita bruta / ano", valor: formatBRL(res.receitaBrutaAnual) },
                  { label: "Custos / ano", valor: `− ${formatBRL(res.custosAnuais)}` },
                  { label: `Taxa de serviço (${taxaTexto} por contrato)`, valor: `− ${formatBRL(res.comissaoAnual)}` },
                  { label: "Reposição e desgaste da mobília / ano", valor: `− ${formatBRL(res.reposicaoAnual)}` },
                  { label: "Receita líquida / ano", valor: formatBRL(res.receitaLiquidaAnual) },
                  { label: "Média mensal no bolso", valor: `${formatBRL(res.mediaMensal)}/mês` },
                ],
                cenarios: cenarios.map((c) => ({ label: `${c.nome} (${c.mesesOcupados} meses)`, valor: `${formatBRL(c.liquida)}/ano` })),
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
        </div>
      </div>

      <section aria-labelledby="sim-cenarios" className="mt-6 rounded-xl border border-sage-200 bg-white p-5" data-testid="sim-cenarios">
        <h2 id="sim-cenarios" className="font-title text-lg font-semibold text-ink">
          Cenários de ocupação
        </h2>
        <p className="mt-1 text-xs text-muted">A mesma conta com 2 meses a menos e 2 a mais que o seu número.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Cenário</th>
                <th className="py-2 pr-3 font-medium">Meses ocupados</th>
                <th className="py-2 pr-3 text-right font-medium">Líquida / ano</th>
                <th className="py-2 text-right font-medium">Por mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200">
              {cenarios.map((c) => (
                <tr key={c.nome} className={c.nome === "Realista" ? "font-semibold text-forest" : "text-ink"}>
                  <td className="py-2 pr-3">{c.nome}</td>
                  <td className="py-2 pr-3">{c.mesesOcupados}</td>
                  <td className="py-2 pr-3 text-right">{formatBRL(c.liquida)}</td>
                  <td className="py-2 text-right">{formatBRL(Math.round(c.liquida / 12))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ComoCalculamos itens={COMO_CALCULAMOS} testid="sim-como-calculamos" />

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/dashboard/imoveis/novo" className={buttonClasses({ size: "md" })}>
          Anunciar meu imóvel
        </Link>
      </div>
    </>
  );
}
