"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Home, Download, Info, Scale } from "lucide-react";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { useProperties } from "@/lib/use-properties";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, pctTexto, rotuloTaxaServico, taxaPublicaTexto } from "@/lib/cobranca/regra";
import { calcularImovel, entradaVazia, type EntradaImovel, type TradicionalDigitado } from "@/lib/calculo-imovel";
import { COMPARE_RODAPE, RETORNO_AIRBNB_UBERLANDIA, canaisDaCalculadora } from "@/config/compare-precos";
import { formatBRL, numBR } from "@/lib/utils";
import { BarraValor, CobrancaToggle, ComoCalculamos, GraficoColunas, NumInput, ResultCard, SimDisclaimer, SimHero } from "@/components/simulador/ui";
import { MAX_ALUGUEL_MENSAL, MAX_INVESTIMENTO } from "@/lib/campos-valor";
import { buttonClasses } from "@/components/ui/button";

const PRAZOS = [2, 3, 4, 6];

/**
 * E294 — o Simulador de rentabilidade e a Calculadora de ROI viraram UM cálculo só (lib/calculo-imovel.ts), com os
 * números que o dono digita ("a Viva só conecta", diretriz do Daniel de 31/10). Tudo começa vazio: nada de valor de
 * exemplo nem de padrão de mercado. Sem valor mensal e meses ocupados, não há resultado; sem o valor mensal do
 * contrato tradicional, não há comparação. /dashboard/roi-imovel leva para cá.
 */
const COMO_CALCULAMOS = [
  "Tudo sai dos números que você digitou. Campo vazio vale zero; a Viva não preenche nenhum valor por você.",
  "Receita bruta do ano = valor mensal × meses ocupados.",
  "Taxa de serviço = taxa da sua faixa sobre o valor mensal × meses ocupados. Ela nunca incide sobre condomínio, IPTU ou contas cobrados à parte, nem sobre limpeza ou taxa pet.",
  "Condomínio + IPTU cobrados à parte: o morador paga junto com o valor mensal nos meses ocupados; você paga só nos meses vazios. Incluídos no valor mensal: você paga os 12 meses.",
  "Contas de consumo cobradas à parte: o morador paga. Incluídas no valor mensal: você paga nos meses ocupados.",
  "Reposição e desgaste da mobília = investimento na mobília × % ao ano que você informou.",
  "Receita líquida = receita bruta − custos − taxa de serviço − reposição da mobília. A média mensal é a líquida do ano dividida por 12.",
  "Rentabilidade sobre o imóvel = receita líquida do ano ÷ valor do imóvel (só aparece se você informar o valor).",
  "Contrato tradicional (só com o valor mensal dele digitado): valor mensal × (12 − meses vazios) × (1 − taxa de administração) − 1 valor mensal a cada N meses de contrato (taxa de contrato) − condomínio/IPTU nos meses vazios. Os números são os que você digitou: confira com a sua imobiliária.",
  "Ganho adicional = líquido do mobiliado − líquido do tradicional, no mesmo ano. Payback = investimento ÷ ganho adicional por mês. ROI anual = ganho adicional ÷ investimento.",
  "Ponto de equilíbrio: o menor valor mensal mobiliado (com a sua ocupação) e a menor ocupação (com o seu valor) que empatam com o tradicional, sem contar o investimento inicial.",
  "Cenários: a mesma conta com 2 meses ocupados a menos e 2 a mais que o seu número, entre 1 e 12 meses.",
];

export default function SimuladorPage() {
  const { properties } = useProperties("/api/properties/mine");
  const [imoveisAtivos, setImoveisAtivos] = useState(1);
  const [e, setE] = useState<EntradaImovel>(entradaVazia);
  const muda = <K extends keyof EntradaImovel>(k: K) => (v: EntradaImovel[K]) => setE((x) => ({ ...x, [k]: v }));
  const mudaTrad = <K extends keyof TradicionalDigitado>(k: K) => (v: number) => setE((x) => ({ ...x, tradicional: { ...x.tradicional, [k]: v } }));

  // Regra única: taxa de serviço por contrato fechado, pela faixa do nº de imóveis ativos (o preço da Viva).
  const faixa = faixaPorImoveisAtivos(imoveisAtivos);
  const taxaTexto = taxaPublicaTexto(faixa);
  const calc = useMemo(() => calcularImovel(e, faixa.taxa), [e, faixa.taxa]);
  const res = calc.rentabilidade;
  const cmp = calc.comparacao;
  const maxBarra = Math.max(1, res.receitaBrutaAnual);
  const comparativo = canaisDaCalculadora({ taxaAdm: e.tradicional.taxaAdmPct / 100, intermediacaoACadaMeses: e.tradicional.intermediacaoACadaMeses });

  function usarMeuImovel() {
    const im = properties[0];
    if (!im) return;
    setE((x) => ({
      ...x,
      valorMensal: Math.round(im.monthlyPrice) || x.valorMensal,
      condoIptu: im.condoFee ? Math.round(im.condoFee) : x.condoIptu,
      contas: im.utilitiesEstimate ? Math.round(im.utilitiesEstimate) : x.contas,
    }));
  }

  const paybackTexto = !cmp || cmp.paybackMeses === null ? "—" : cmp.paybackMeses === 0 ? "Imediato" : `${cmp.paybackMeses} meses`;
  const roiTexto = !cmp || cmp.roiAnual === null ? "—" : `${Math.round(cmp.roiAnual * 100)}%`;

  return (
    <>
      <PageTitle title="Simulador do imóvel" subtitle="Rentabilidade, comparação com o contrato tradicional e retorno da mobília numa conta só, com os seus números." />

      <SimHero
        icon={TrendingUp}
        titulo="Simule o seu imóvel com os seus números"
        subtitulo="Digite os valores do seu imóvel. Nada vem preenchido: a conta usa só o que você informar, já descontada a taxa de serviço da sua faixa."
        stats={[
          { label: "Taxa de serviço da sua faixa", valor: taxaTexto },
          { label: "Média mensal no bolso (sua simulação)", valor: calc.pronto ? formatBRL(res.mediaMensal) : "—" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <div className="space-y-4">
          <div className="rounded-xl border border-sage-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-title text-lg font-semibold text-ink">Mobiliado na Viva</h2>
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
              <NumInput label="Valor mensal pretendido" value={e.valorMensal} onChange={muda("valorMensal")} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} vazioQuandoZero testid="sim-valor-mensal" />
              <div>
                <NumInput label="Condomínio + IPTU (mês)" value={e.condoIptu} onChange={muda("condoIptu")} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} vazioQuandoZero />
                <CobrancaToggle rotulo="Como o condomínio + IPTU chega ao morador" value={e.condoCobranca} onChange={muda("condoCobranca")} testid="cobranca-condo" />
              </div>
              <div>
                <NumInput label="Contas de consumo — água, luz, internet (mês)" value={e.contas} onChange={muda("contas")} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} vazioQuandoZero />
                <CobrancaToggle rotulo="Como as contas chegam ao morador" value={e.contasCobranca} onChange={muda("contasCobranca")} testid="cobranca-contas" />
              </div>
              <NumInput label="Meses ocupados no ano (1 a 12)" value={e.mesesOcupados} onChange={(v) => muda("mesesOcupados")(Math.min(12, v))} step={1} max={12} vazioQuandoZero testid="sim-meses" />
              <div>
                <p className="mb-1 text-sm font-medium text-ink">Prazo médio por contrato (opcional)</p>
                <div className="flex flex-wrap gap-2" data-testid="sim-prazo">
                  {PRAZOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={e.prazoMedioMeses === m}
                      onClick={() => muda("prazoMedioMeses")(e.prazoMedioMeses === m ? 0 : m)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${e.prazoMedioMeses === m ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"}`}
                    >
                      {m} meses
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0" data-testid="sim-reposicao">
                <NumInput label="Investimento na mobília" value={e.investimentoMobilia} onChange={muda("investimentoMobilia")} step={1000} prefix="R$" max={MAX_INVESTIMENTO} vazioQuandoZero testid="sim-investimento" />
                <NumInput label="Reposição e desgaste da mobília (% do investimento por ano)" value={e.reposicaoPct} onChange={muda("reposicaoPct")} step={1} max={100} vazioQuandoZero />
              </div>
              <p className="flex items-start gap-2 text-xs text-muted">
                <Info className="mt-1 h-3.5 w-3.5 shrink-0" /> O investimento na mobília entra no payback e no ROI; deixe vazio se o imóvel já é mobiliado.
              </p>
              <div>
                <NumInput label="Valor do imóvel (opcional)" value={e.valorImovel} onChange={muda("valorImovel")} step={10000} prefix="R$" max={MAX_INVESTIMENTO * 10} vazioQuandoZero />
                <p className="mt-1 text-xs text-muted">Para ver a rentabilidade sobre o valor do imóvel.</p>
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
                  onChange={(ev) => setImoveisAtivos(Number(ev.target.value))}
                  className="w-full accent-forest"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sage-200 bg-white p-4" data-testid="roi-tradicional">
            <h2 className="font-title text-lg font-semibold text-ink">Contrato tradicional (opcional, para comparar)</h2>
            <p className="mt-1 text-xs text-muted">Digite os números do contrato tradicional que você tem ou que a sua imobiliária ofereceu. Sem o valor mensal, não há comparação.</p>
            <div className="mt-4 space-y-4">
              <NumInput label="Valor mensal do tradicional (sem mobília)" value={e.tradicional.valorMensal} onChange={mudaTrad("valorMensal")} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} vazioQuandoZero testid="roi-valor-tradicional" />
              <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                <NumInput label="Meses vazios por ano" value={e.tradicional.mesesVazios} onChange={(v) => mudaTrad("mesesVazios")(Math.min(12, v))} step={1} max={12} vazioQuandoZero />
                <NumInput label="Taxa de administração (%)" value={e.tradicional.taxaAdmPct} onChange={mudaTrad("taxaAdmPct")} step={1} max={100} vazioQuandoZero />
              </div>
              <div>
                <NumInput label="Taxa de contrato: 1 valor mensal a cada (meses)" value={e.tradicional.intermediacaoACadaMeses} onChange={mudaTrad("intermediacaoACadaMeses")} step={6} max={120} vazioQuandoZero />
                <p className="mt-1 text-xs text-muted">Deixe vazio se a sua imobiliária não cobra.</p>
              </div>
              <div>
                <NumInput label="Rendimento anual se o investimento ficasse aplicado (%) — opcional" value={e.rendimentoPct} onChange={muda("rendimentoPct")} step={1} max={100} vazioQuandoZero />
                <p className="mt-1 text-xs text-muted">Deixe vazio para não comparar com uma aplicação.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          {!calc.pronto ? (
            <div className="rounded-xl border border-sage-200 bg-white p-4" data-testid="sim-vazio">
              <p className="font-title text-base font-semibold text-ink">Digite os seus números para ver a conta</p>
              <p className="mt-1 text-sm text-muted">
                Comece pelo valor mensal pretendido e pelos meses ocupados no ano. O resto é opcional: custos, mobília, valor do imóvel e, para comparar, o contrato tradicional.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <ResultCard label="Receita bruta / ano" value={formatBRL(res.receitaBrutaAnual)} />
                <ResultCard
                  label="Custos / ano"
                  value={`− ${formatBRL(res.custosAnuais)}`}
                  hint={e.condoCobranca === "aparte" && e.contasCobranca === "aparte" ? "condomínio só nos meses vazios" : undefined}
                />
                <ResultCard
                  label={`Taxa de serviço (${taxaTexto})`}
                  value={`− ${formatBRL(res.comissaoAnual)}`}
                  hint={calc.contratosPorAno !== null ? `${numBR(calc.contratosPorAno, 1)} contrato(s)/ano` : undefined}
                />
                <ResultCard
                  label="Reposição e desgaste da mobília / ano"
                  value={`− ${formatBRL(res.reposicaoAnual)}`}
                  hint={e.investimentoMobilia > 0 ? `${numBR(e.reposicaoPct, 1)}% de ${formatBRL(e.investimentoMobilia)}` : undefined}
                />
              </div>
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted" data-testid="sim-taxa-rotulo">
                {rotuloTaxaServico(faixa.taxa, e.valorMensal, Math.min(12, e.mesesOcupados), res.comissaoAnual)} no ano.
              </p>
              <div className="rounded-xl border border-forest bg-forest p-4 text-white" data-testid="sim-liquida">
                <p className="text-sm text-white/80">Receita líquida estimada / ano</p>
                <p className="font-title text-2xl font-semibold">{formatBRL(res.receitaLiquidaAnual)}</p>
                <p className="mt-1 text-sm text-white/85">
                  {faixa.negociavel ? (
                    <>Com {faixa.minImoveis}+ imóveis a taxa é negociável: este valor usa {pctTexto(faixa.taxa)} só como referência.</>
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

              <div className="rounded-xl border border-sage-200 bg-white p-4" data-testid="sim-grafico">
                <p className="text-sm font-medium text-ink">Para onde vai a receita do ano</p>
                <div className="mt-3 space-y-2">
                  <BarraValor label="Receita bruta" valor={res.receitaBrutaAnual} max={maxBarra} tone="sage" formatar={formatBRL} />
                  <BarraValor label="Custos" valor={-res.custosAnuais} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
                  <BarraValor label="Taxa de serviço" valor={-res.comissaoAnual} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
                  <BarraValor label="Reposição" valor={-res.reposicaoAnual} max={maxBarra} tone="champagne" formatar={(v) => `− ${formatBRL(Math.abs(v))}`} />
                  <BarraValor label="Líquida" valor={res.receitaLiquidaAnual} max={maxBarra} tone="forest" formatar={formatBRL} />
                </div>
              </div>

              {cmp ? (
                <>
                  <div className="grid grid-cols-2 gap-4" data-testid="roi-resultado">
                    <ResultCard
                      label="Prêmio do mobiliado"
                      value={`${cmp.premioMensal >= 0 ? "+ " : "− "}${formatBRL(Math.abs(cmp.premioMensal))}/mês`}
                      hint={`${Math.round(Math.abs(cmp.premioPct) * 100)}% ${cmp.premioMensal >= 0 ? "acima" : "abaixo"} do tradicional`}
                    />
                    <ResultCard label="Ganho líquido adicional / ano" value={formatBRL(cmp.ganhoAdicionalAnual)} hint="mobiliado × tradicional, com taxas, custos e reposição" />
                    <ResultCard
                      label="Payback do investimento"
                      value={paybackTexto}
                      hint={cmp.paybackMeses === null ? "o mobiliado não rende mais que o tradicional" : cmp.paybackMeses === 0 ? "sem investimento a recuperar" : `≈ ${numBR(cmp.paybackMeses / 12, 1)} anos`}
                    />
                    <ResultCard label="ROI anual" value={roiTexto} hint={cmp.roiAnual === null ? "sem investimento na mobília para comparar" : undefined} />
                  </div>
                  <div className="grid grid-cols-2 gap-4" data-testid="roi-liquidos">
                    <ResultCard label="Líquido do mobiliado / ano" value={formatBRL(cmp.netMobiliadoAnual)} />
                    <ResultCard label="Líquido do tradicional / ano" value={formatBRL(cmp.netVazioAnual)} />
                  </div>
                  <div className="rounded-xl border border-forest/30 bg-sage-100/50 p-4" data-testid="roi-equilibrio">
                    <p className="flex items-center gap-2 text-sm font-semibold text-forest">
                      <Scale className="h-4 w-4" aria-hidden /> Ponto de equilíbrio com o tradicional
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-ink">
                      <li data-testid="roi-equilibrio-valor">
                        {cmp.valorMinimoEmpate === null ? (
                          <>Com {e.mesesOcupados} meses ocupados, nenhum valor mensal empata.</>
                        ) : (
                          <>
                            Valor mensal mobiliado mínimo: <strong>{formatBRL(cmp.valorMinimoEmpate)}</strong> (com {e.mesesOcupados} meses ocupados)
                          </>
                        )}
                      </li>
                      <li data-testid="roi-equilibrio-ocupacao">
                        {cmp.ocupacaoMinimaEmpate === null ? (
                          <>Com {formatBRL(e.valorMensal)}/mês, nem 12 meses ocupados empatam.</>
                        ) : (
                          <>
                            Ocupação mínima: <strong>{cmp.ocupacaoMinimaEmpate} {cmp.ocupacaoMinimaEmpate === 1 ? "mês" : "meses"} por ano</strong> (com{" "}
                            {formatBRL(e.valorMensal)}/mês)
                          </>
                        )}
                      </li>
                      {cmp.versusAplicacaoAnual !== null && (
                        <li data-testid="roi-aplicacao">
                          Contra a aplicação a {numBR(e.rendimentoPct, 1)}% ao ano:{" "}
                          <strong>
                            {cmp.versusAplicacaoAnual >= 0 ? "+ " : "− "}
                            {formatBRL(Math.abs(cmp.versusAplicacaoAnual))}/ano
                          </strong>{" "}
                          {cmp.versusAplicacaoAnual >= 0 ? "a favor do mobiliado" : "a favor da aplicação"}
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-sage-200 bg-white p-4" data-testid="roi-grafico">
                    <p className="text-sm font-medium text-ink">Acumulado — mobiliado × tradicional</p>
                    <div className="mt-4">
                      <GraficoColunas
                        testid="roi-acumulado"
                        legenda="Acumulado do mobiliado e do tradicional, por ano"
                        series={[
                          { nome: "Mobiliado", cor: "bg-forest" },
                          { nome: "Tradicional", cor: "bg-sage" },
                        ]}
                        grupos={cmp.acumulado.map((a) => ({ rotulo: `Ano ${a.ano}`, valores: [a.mobiliado, a.vazio] }))}
                        formatar={formatBRL}
                      />
                    </div>
                    <p className="mt-3 text-[11px] text-muted">O mobiliado desconta o investimento no ano 1 — por isso pode começar atrás e ultrapassar depois.</p>
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted" data-testid="roi-sem-tradicional">
                  Para comparar com o contrato tradicional (prêmio, payback, ROI e ponto de equilíbrio), digite o valor mensal dele ao lado.
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  imprimirSimulacao({
                    titulo: "Simulação do imóvel",
                    subtitulo: rotuloTaxaServico(faixa.taxa, e.valorMensal, Math.min(12, e.mesesOcupados), res.comissaoAnual),
                    entradas: [
                      { label: "Valor mensal pretendido", valor: formatBRL(e.valorMensal) },
                      { label: "Condomínio + IPTU (mês)", valor: `${formatBRL(e.condoIptu)} · ${e.condoCobranca === "aparte" ? "cobrado à parte" : "incluído"}` },
                      { label: "Contas de consumo (mês)", valor: `${formatBRL(e.contas)} · ${e.contasCobranca === "aparte" ? "cobradas à parte" : "incluídas"}` },
                      { label: "Meses ocupados no ano", valor: String(e.mesesOcupados) },
                      { label: "Reposição e desgaste da mobília", valor: `${numBR(e.reposicaoPct, 1)}% de ${formatBRL(e.investimentoMobilia)} por ano` },
                      ...(cmp
                        ? [
                            {
                              label: "Tradicional: valor mensal · meses vazios · administração · taxa de contrato",
                              valor: `${formatBRL(e.tradicional.valorMensal)} · ${e.tradicional.mesesVazios} · ${numBR(e.tradicional.taxaAdmPct, 1)}% · ${e.tradicional.intermediacaoACadaMeses > 0 ? `1 a cada ${e.tradicional.intermediacaoACadaMeses} meses` : "não cobra"}`,
                            },
                          ]
                        : []),
                    ],
                    resultados: [
                      { label: "Receita bruta / ano", valor: formatBRL(res.receitaBrutaAnual) },
                      { label: "Custos / ano", valor: `− ${formatBRL(res.custosAnuais)}` },
                      { label: `Taxa de serviço (${taxaTexto} por contrato)`, valor: `− ${formatBRL(res.comissaoAnual)}` },
                      { label: "Reposição e desgaste da mobília / ano", valor: `− ${formatBRL(res.reposicaoAnual)}` },
                      { label: "Receita líquida / ano", valor: formatBRL(res.receitaLiquidaAnual) },
                      { label: "Média mensal no bolso", valor: `${formatBRL(res.mediaMensal)}/mês` },
                      ...(cmp
                        ? [
                            { label: "Ganho líquido adicional / ano (× tradicional)", valor: formatBRL(cmp.ganhoAdicionalAnual) },
                            { label: "Payback do investimento", valor: paybackTexto },
                            { label: "ROI anual", valor: roiTexto },
                          ]
                        : []),
                    ],
                    cenarios: calc.cenarios.map((c) => ({ label: `${c.nome} (${c.mesesOcupados} meses)`, valor: `${formatBRL(c.liquidaAnual)}/ano` })),
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-3 text-sm font-medium text-forest hover:border-sage"
              >
                <Download className="h-4 w-4" /> Baixar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {calc.pronto && (
        <section aria-labelledby="sim-cenarios-titulo" className="mt-6 rounded-xl border border-sage-200 bg-white p-4" data-testid="sim-cenarios">
          <h2 id="sim-cenarios-titulo" className="font-title text-lg font-semibold text-ink">
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
                  <th className="py-2 pr-3 text-right font-medium">Por mês</th>
                  {cmp && <th className="py-2 text-right font-medium">Ganho × tradicional</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {calc.cenarios.map((c) => (
                  <tr key={c.nome} className={c.nome === "Realista" ? "font-semibold text-forest" : "text-ink"}>
                    <td className="py-2 pr-3">{c.nome}</td>
                    <td className="py-2 pr-3">{c.mesesOcupados}</td>
                    <td className="py-2 pr-3 text-right">{formatBRL(c.liquidaAnual)}</td>
                    <td className="py-2 pr-3 text-right">{formatBRL(Math.round(c.liquidaAnual / 12))}</td>
                    {cmp && <td className="py-2 text-right">{formatBRL(c.ganhoAdicionalAnual ?? 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cmp && (
        <section aria-labelledby="comparar-canais" className="mt-6 rounded-xl border border-sage-200 bg-white p-4">
          <h2 id="comparar-canais" className="font-title text-lg font-semibold text-ink">
            Quanto fica de cada mês em cada canal
          </h2>
          <p className="mt-1 text-xs text-muted">Percentual do total pago pelo morador que o canal retém. A Viva é o preço dela; o Airbnb é o da página dele; o tradicional é o que você digitou.</p>
          <ul className="mt-3 space-y-2" data-testid="roi-canais">
            {comparativo.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 text-sm" data-testid="roi-canal">
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
      )}

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
