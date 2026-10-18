"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Percent, Info, Download, Scale } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { FAIXAS_COMISSAO_PADRAO, comissaoSobreContrato, faixaPorImoveisAtivos, pctTexto, rotuloTaxaServico } from "@/lib/cobranca/regra";
import { COMPARE_RODAPE, RETORNO_AIRBNB_UBERLANDIA, canaisDaCalculadora } from "@/config/compare-precos";
import { PADROES_TRADICIONAL, cenariosOcupacao, simularROI, type Cobranca, type EntradaROI } from "@/lib/simulador";
import { imprimirSimulacao } from "@/lib/print-simulacao";
import { formatBRL, numBR } from "@/lib/utils";
import { MAX_ALUGUEL_MENSAL, MAX_INVESTIMENTO } from "@/lib/campos-valor";
import { CobrancaToggle, ComoCalculamos, GraficoColunas, NumInput, ResultCard, SimDisclaimer, SimHero } from "@/components/simulador/ui";
import { buttonClasses } from "@/components/ui/button";

const INCLUI =
  "Móveis dos quartos e sala, cozinha equipada, eletrodomésticos, cama/colchão, mesa de trabalho, cortinas e utensílios.";

/** Fórmulas da tela (prompt 15). O mobiliado usa a MESMA base do simulador (baseMobiliadoAno). */
const COMO_CALCULAMOS = [
  "Mobiliado: valor mensal × meses ocupados − taxa de serviço da sua faixa (sobre o valor mensal × meses) − condomínio/IPTU e contas conforme a cobrança − reposição e desgaste da mobília. É a mesma função do Simulador de rentabilidade: com os mesmos números, o líquido é igual.",
  "Tradicional (12 meses ou mais, sem mobília): valor mensal × (12 − meses vazios) × (1 − taxa de administração) − 1 valor mensal a cada N meses de contrato (taxa de contrato da imobiliária) − condomínio/IPTU nos meses vazios.",
  "Os padrões do tradicional (1 mês vazio por ano, 10% de administração, 1 valor mensal a cada 30 meses) são referência de mercado: confira com a sua imobiliária e ajuste.",
  "Ganho adicional = líquido do mobiliado − líquido do tradicional, no mesmo ano. Payback = investimento ÷ ganho adicional por mês. ROI anual = ganho adicional ÷ investimento.",
  "Ponto de equilíbrio: o menor valor mensal mobiliado (com a sua ocupação) e a menor ocupação (com o seu valor) que empatam com o tradicional, sem contar o investimento inicial.",
  "Acumulado: o mobiliado desconta o investimento no ano 1; por isso pode começar atrás e passar depois.",
  "Aplicação (opcional): se você informar um rendimento anual, comparamos o ganho adicional com o que o investimento renderia aplicado.",
];

export default function RoiImovelPage() {
  const [imoveisAtivos, setImoveisAtivos] = useState(1);
  const [investimentoMobiliar, setInvest] = useState(25000);
  const [aluguelVazio, setVazio] = useState(1800);
  const [aluguelMobiliado, setMob] = useState(3000);
  const [mesesOcupados, setMeses] = useState(10);
  const [condoIptu, setCondoIptu] = useState(0);
  const [condoCobranca, setCondoCobranca] = useState<Cobranca>("aparte");
  const [contasMensais, setContas] = useState(400);
  const [contasCobranca, setContasCobranca] = useState<Cobranca>("aparte");
  const [reposicaoPct, setReposicao] = useState(10);
  const [mesesVaziosTrad, setVaziosTrad] = useState<number>(PADROES_TRADICIONAL.mesesVazios);
  const [admTradPct, setAdmTrad] = useState<number>(PADROES_TRADICIONAL.taxaAdm * 100);
  const [contratoACada, setContratoACada] = useState<number>(PADROES_TRADICIONAL.intermediacaoACadaMeses);
  const [rendimentoPct, setRendimento] = useState(0);

  const base: Omit<EntradaROI, "mesesOcupados"> = {
    investimentoMobiliar,
    aluguelVazio,
    aluguelMobiliado,
    prazoMedioMeses: 4,
    contasMensais,
    reposicaoAnualPct: reposicaoPct / 100,
    condoIptu,
    condoCobranca,
    contasCobranca,
    mesesVaziosTradicional: mesesVaziosTrad,
    taxaAdmTradicional: admTradPct / 100,
    intermediacaoACadaMeses: contratoACada,
    rendimentoAplicacaoPct: rendimentoPct > 0 ? rendimentoPct / 100 : undefined,
  };
  // Regra única: taxa de serviço por contrato fechado, pela faixa do nº de imóveis ativos. Sem assinatura nesta fase.
  const faixa = faixaPorImoveisAtivos(imoveisAtivos);
  const res = useMemo(
    () => simularROI({ ...base, mesesOcupados }, faixa.taxa, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `base` é recriada a cada render; os campos dela estão aqui
    [investimentoMobiliar, aluguelVazio, aluguelMobiliado, mesesOcupados, condoIptu, condoCobranca, contasMensais, contasCobranca, reposicaoPct, mesesVaziosTrad, admTradPct, contratoACada, rendimentoPct, faixa.taxa]
  );
  const cenarios = cenariosOcupacao(mesesOcupados).map((c) => ({
    ...c,
    r: simularROI({ ...base, mesesOcupados: c.mesesOcupados }, faixa.taxa, 0),
  }));
  // Prompt 27: Viva, Airbnb (com fonte) e o contrato tradicional com os números desta tela (decisão do Daniel, prompt 15, item 4).
  const comparativo = canaisDaCalculadora({ taxaAdm: admTradPct / 100, intermediacaoACadaMeses: contratoACada });

  // Textos dos resultados (prêmio com sinal; payback/ROI sem investimento).
  const premioTexto = `${res.premioMensal >= 0 ? "+ " : "− "}${formatBRL(Math.abs(res.premioMensal))}/mês`;
  const premioDica =
    res.premioMensal >= 0
      ? `${Math.round(res.premioPct * 100)}% acima do tradicional`
      : `${Math.round(Math.abs(res.premioPct) * 100)}% abaixo do tradicional`;
  const paybackTexto =
    res.paybackMeses === null ? "—" : res.paybackMeses === 0 ? "Imediato" : `${res.paybackMeses} meses`;
  const paybackDica =
    res.paybackMeses === null
      ? "o mobiliado não rende mais que o tradicional"
      : res.paybackMeses === 0
        ? "sem investimento a recuperar"
        : `≈ ${numBR(res.paybackMeses / 12, 1)} anos`;
  const roiTexto = res.roiAnual === null ? "—" : `${Math.round(res.roiAnual * 100)}%`;


  return (
    <>
      <PageTitle capa="roi" title="Calculadora de ROI" subtitle="Vale a pena mobiliar o seu imóvel para média duração?" />

      <SimHero
        icon={Percent}
        titulo="Vale a pena mobiliar?"
        subtitulo="Compare o mobiliado com o contrato tradicional, nas mesmas condições, e veja em quanto tempo o investimento se paga."
        stats={[
          { label: "Ganho adicional por ano (sua simulação)", valor: formatBRL(res.ganhoAdicionalAnual) },
          { label: "Payback (sua simulação)", valor: paybackTexto },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Entradas */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-sage-200 bg-white p-5">
            <h2 className="font-title text-lg font-bold text-ink">Mobiliado na Viva</h2>
            <div className="mt-4 space-y-4">
              <div>
                <NumInput label="Investimento para mobiliar" value={investimentoMobiliar} onChange={setInvest} step={1000} prefix="R$" max={MAX_INVESTIMENTO} />
                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {INCLUI}
                </p>
              </div>
              <NumInput label="Valor mensal MOBILIADO pretendido" value={aluguelMobiliado} onChange={setMob} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
              <div>
                <NumInput label="Condomínio + IPTU (mês)" value={condoIptu} onChange={setCondoIptu} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
                <CobrancaToggle rotulo="Como o condomínio + IPTU chega ao morador" value={condoCobranca} onChange={setCondoCobranca} testid="roi-cobranca-condo" />
              </div>
              <div>
                <NumInput label="Contas de consumo — água, luz, internet (mês)" value={contasMensais} onChange={setContas} step={50} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
                <CobrancaToggle rotulo="Como as contas chegam ao morador" value={contasCobranca} onChange={setContasCobranca} testid="roi-cobranca-contas" />
              </div>
              <NumInput label="Reposição e desgaste da mobília (% do investimento por ano)" value={reposicaoPct} onChange={setReposicao} step={1} max={100} />
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">
                  Meses ocupados no ano (mobiliado): <strong className="text-forest">{mesesOcupados}</strong>
                </label>
                <input
                  type="range"
                  min={6}
                  max={12}
                  value={mesesOcupados}
                  onChange={(e) => setMeses(Number(e.target.value))}
                  className="w-full accent-forest"
                  aria-label="Meses ocupados no ano (mobiliado)"
                />
              </div>
              <div>
                <label htmlFor="imoveis-ativos" className="mb-1 block text-sm font-medium text-ink">
                  Imóveis ativos na Viva: <strong className="text-forest">{imoveisAtivos}</strong> · taxa de serviço{" "}
                  <strong className="text-forest">{pctTexto(faixa.taxa)}</strong> sobre o valor mensal × meses de cada contrato
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

          <div className="rounded-2xl border border-sage-200 bg-white p-5" data-testid="roi-tradicional">
            <h2 className="font-title text-lg font-bold text-ink">Contrato tradicional (sem mobília)</h2>
            <p className="mt-1 text-xs text-muted">Padrões de referência de mercado — confira com a sua imobiliária e ajuste.</p>
            <div className="mt-4 space-y-4">
              <NumInput label="Valor mensal VAZIO de referência" value={aluguelVazio} onChange={setVazio} step={100} prefix="R$" max={MAX_ALUGUEL_MENSAL} />
              <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                <NumInput label="Meses vazios por ano" value={mesesVaziosTrad} onChange={(v) => setVaziosTrad(Math.min(12, v))} step={1} max={12} />
                <NumInput label="Taxa de administração (%)" value={admTradPct} onChange={setAdmTrad} step={1} max={100} />
              </div>
              <div>
                <NumInput label="Taxa de contrato: 1 valor mensal a cada (meses)" value={contratoACada} onChange={setContratoACada} step={6} max={120} />
                <p className="mt-1 text-xs text-muted">Use 0 se a sua imobiliária não cobra.</p>
              </div>
              <div>
                <NumInput label="Rendimento anual se o investimento ficasse aplicado (%) — opcional" value={rendimentoPct} onChange={setRendimento} step={1} max={100} />
                <p className="mt-1 text-xs text-muted">Deixe 0 para não comparar com uma aplicação.</p>
              </div>
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
              hint="mobiliado × tradicional, com taxas, custos e reposição"
            />
            <ResultCard label="Payback do investimento" value={paybackTexto} hint={paybackDica} />
            <ResultCard label="ROI anual" value={roiTexto} hint={res.roiAnual === null ? "sem investimento para comparar" : undefined} />
          </div>

          <div className="grid grid-cols-2 gap-4" data-testid="roi-liquidos">
            <ResultCard label="Líquido do mobiliado / ano" value={formatBRL(res.netMobiliadoAnual)} />
            <ResultCard label="Líquido do tradicional / ano" value={formatBRL(res.netVazioAnual)} />
          </div>

          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted" data-testid="roi-taxa-rotulo">
            {rotuloTaxaServico(faixa.taxa, aluguelMobiliado, mesesOcupados, comissaoSobreContrato(aluguelMobiliado, mesesOcupados, faixa.taxa))} no ano (mobiliado).
          </p>

          {/* Ponto de equilíbrio. */}
          <div className="rounded-2xl border border-forest/30 bg-sage-100/50 p-5" data-testid="roi-equilibrio">
            <p className="flex items-center gap-2 text-sm font-bold text-forest">
              <Scale className="h-4 w-4" aria-hidden /> Ponto de equilíbrio com o tradicional
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              <li data-testid="roi-equilibrio-valor">
                {res.valorMinimoEmpate === null ? (
                  <>Com {mesesOcupados} meses ocupados, nenhum valor mensal empata.</>
                ) : (
                  <>
                    Valor mensal mobiliado mínimo: <strong>{formatBRL(res.valorMinimoEmpate)}</strong> (com {mesesOcupados} meses ocupados)
                  </>
                )}
              </li>
              <li data-testid="roi-equilibrio-ocupacao">
                {res.ocupacaoMinimaEmpate === null ? (
                  <>Com {formatBRL(aluguelMobiliado)}/mês, nem 12 meses ocupados empatam.</>
                ) : (
                  <>
                    Ocupação mínima: <strong>{res.ocupacaoMinimaEmpate} {res.ocupacaoMinimaEmpate === 1 ? "mês" : "meses"} por ano</strong> (com{" "}
                    {formatBRL(aluguelMobiliado)}/mês)
                  </>
                )}
              </li>
              {res.versusAplicacaoAnual !== null && (
                <li data-testid="roi-aplicacao">
                  Contra a aplicação a {numBR(rendimentoPct, 1)}% ao ano:{" "}
                  <strong>
                    {res.versusAplicacaoAnual >= 0 ? "+ " : "− "}
                    {formatBRL(Math.abs(res.versusAplicacaoAnual))}/ano
                  </strong>{" "}
                  {res.versusAplicacaoAnual >= 0 ? "a favor do mobiliado" : "a favor da aplicação"}
                </li>
              )}
            </ul>
          </div>

          {/* Gráfico: acumulado ano 1-2-3 mobiliado × tradicional */}
          <div className="rounded-2xl border border-sage-200 bg-white p-5" data-testid="roi-grafico">
            <p className="text-sm font-medium text-ink">Acumulado — mobiliado × tradicional</p>
            <div className="mt-4">
              <GraficoColunas
                testid="roi-acumulado"
                legenda="Acumulado do mobiliado e do tradicional, por ano"
                series={[
                  { nome: "Mobiliado", cor: "bg-forest" },
                  { nome: "Tradicional", cor: "bg-sage" },
                ]}
                grupos={res.acumulado.map((a) => ({ rotulo: `Ano ${a.ano}`, valores: [a.mobiliado, a.vazio] }))}
                formatar={formatBRL}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted">O mobiliado desconta o investimento no ano 1 — por isso pode começar atrás e ultrapassar depois.</p>
          </div>

          <button
            type="button"
            onClick={() =>
              imprimirSimulacao({
                titulo: "Calculadora de ROI — mobiliar o imóvel",
                subtitulo: rotuloTaxaServico(faixa.taxa, aluguelMobiliado, mesesOcupados),
                entradas: [
                  { label: "Investimento para mobiliar", valor: formatBRL(investimentoMobiliar) },
                  { label: "Valor mensal tradicional", valor: formatBRL(aluguelVazio) },
                  { label: "Valor mensal mobiliado", valor: formatBRL(aluguelMobiliado) },
                  { label: "Meses ocupados no ano", valor: String(mesesOcupados) },
                  { label: "Tradicional: meses vazios · administração · taxa de contrato", valor: `${mesesVaziosTrad} · ${numBR(admTradPct, 1)}% · 1 a cada ${contratoACada} meses` },
                ],
                resultados: [
                  { label: "Prêmio do mobiliado", valor: premioTexto },
                  { label: "Ganho líquido adicional / ano", valor: formatBRL(res.ganhoAdicionalAnual) },
                  { label: "Payback do investimento", valor: paybackTexto },
                  { label: "ROI anual", valor: roiTexto },
                  { label: "Reposição e desgaste da mobília", valor: `${numBR(reposicaoPct, 1)}% de ${formatBRL(investimentoMobiliar)} por ano` },
                  { label: "Líquido do mobiliado / ano", valor: formatBRL(res.netMobiliadoAnual) },
                ],
                cenarios: cenarios.map((c) => ({
                  label: `${c.nome} (${c.mesesOcupados} meses)`,
                  valor: `${formatBRL(c.r.ganhoAdicionalAnual)}/ano · payback ${c.r.paybackMeses === null ? "—" : c.r.paybackMeses === 0 ? "imediato" : `${c.r.paybackMeses} meses`}`,
                })),
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-sage-200 px-4 py-2.5 text-sm font-medium text-forest hover:border-sage"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
        </div>
      </div>

      <section aria-labelledby="roi-cenarios-titulo" className="mt-6 rounded-2xl border border-sage-200 bg-white p-5" data-testid="roi-cenarios">
        <h2 id="roi-cenarios-titulo" className="font-title text-lg font-bold text-ink">
          Cenários de ocupação
        </h2>
        <p className="mt-1 text-xs text-muted">A mesma conta com 2 meses ocupados a menos e 2 a mais que o seu número.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Cenário</th>
                <th className="py-1.5 pr-3 font-medium">Meses</th>
                <th className="py-1.5 pr-3 text-right font-medium">Ganho / ano</th>
                <th className="py-1.5 text-right font-medium">Payback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200">
              {cenarios.map((c) => (
                <tr key={c.nome} className={c.nome === "Realista" ? "font-semibold text-forest" : "text-ink"}>
                  <td className="py-2 pr-3">{c.nome}</td>
                  <td className="py-2 pr-3">{c.mesesOcupados}</td>
                  <td className="py-2 pr-3 text-right">{formatBRL(c.r.ganhoAdicionalAnual)}</td>
                  <td className="py-2 text-right">
                    {c.r.paybackMeses === null ? "—" : c.r.paybackMeses === 0 ? "Imediato" : `${c.r.paybackMeses} meses`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="comparar-canais" className="mt-6 rounded-2xl border border-sage-200 bg-white p-5">
        <h2 id="comparar-canais" className="font-title text-lg font-bold text-ink">
          Quanto fica de cada mês em cada canal
        </h2>
        <p className="mt-1 text-xs text-muted">Percentual do total pago pelo morador que o canal retém, em média.</p>
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
          Fontes: {comparativo.filter((l) => l.fonte).map((l) => l.fonte?.nome).join("; ")}; {RETORNO_AIRBNB_UBERLANDIA.fonte}. {comparativo.find((l) => l.id === "tradicional")?.nota} {COMPARE_RODAPE}
        </p>
      </section>

      <ComoCalculamos itens={COMO_CALCULAMOS} testid="roi-como-calculamos" />

      <SimDisclaimer />

      <div className="mt-4">
        <Link href="/dashboard/imoveis/novo" className={buttonClasses({ size: "md" })}>
          Anunciar meu imóvel
        </Link>
      </div>
    </>
  );
}
