"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./modelo-negocio.module.css";
import { FAIXAS_COMISSAO_PADRAO, ehPlanoGestor, faixaPorImoveisAtivos, pctTexto, valorTaxa } from "@/lib/cobranca/regra";
import { COMPARE_REFERENCIA, linhasPublicas } from "@/config/compare-precos";
import { SUPORTE_EMAIL } from "@/lib/site";

// ── REGRA ÚNICA (ordens bd296d53 e 2f80c58a; fonte: src/lib/cobranca/regra.ts) ──────────────
// Taxa de serviço por contrato fechado, sobre o valor do 1º mês. Renovação = novo contrato.
// O percentual depende de quantos imóveis ativos o dono tem. Sem cobrança mensal fixa nesta fase
// (assinatura = fase 2, futuro). A Viva não toca no dinheiro da reserva nem da Caução.

interface Cenario {
  nome: string;
  desc: string;
  valorMes: number; // valor do 1º mês do contrato
  meses: number; // duração de cada contrato
  contratos: number; // contratos fechados no ano, por imóvel
}
const CENARIOS: Cenario[] = [
  { nome: "Residência médica", desc: "R$ 3.000 · 6 meses · 2×/ano", valorMes: 3000, meses: 6, contratos: 2 },
  { nome: "Feira / projeto curto", desc: "R$ 2.500 · 2 meses · 4×/ano", valorMes: 2500, meses: 2, contratos: 4 },
  { nome: "Executivo relocado", desc: "R$ 5.000 · 4 meses · 2×/ano", valorMes: 5000, meses: 4, contratos: 2 },
  { nome: "Estúdio econômico", desc: "R$ 1.800 · 3 meses · 3×/ano", valorMes: 1800, meses: 3, contratos: 3 },
];

// Quanto cada canal costuma ficar de cada mês, em média: fonte única com fonte e data por linha
// (config/compare-precos.ts, valores de referência out/2026). Só entra linha com percentual único.
const CANAIS = linhasPublicas()
  .filter((l) => ["quintoandar", "imobiliaria", "airbnb", "booking"].includes(l.id) && l.pct !== null)
  .map((l) => ({ id: l.id, nome: l.nome, pct: l.pct as number }));
const PCT_AIRBNB = CANAIS.find((c) => c.id === "airbnb")?.pct ?? 0;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct1 = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString("pt-BR")}%`;

// Cores da marca para os gráficos.
const C = { forest: "#0f3d2e", sage: "#5a8a6b", gold: "#c8a24b", line: "#e3e9e5", muted: "#6b7280" };

function rotuloFaixa(minImoveis: number, maxImoveis: number | null): string {
  if (maxImoveis === null) return `${minImoveis}+ imóveis`;
  return minImoveis === maxImoveis ? `${minImoveis} imóvel` : `${minImoveis}–${maxImoveis} imóveis`;
}

export function ModeloNegocio() {
  const [valorMes, setValorMes] = useState(CENARIOS[0].valorMes);
  const [meses, setMeses] = useState(CENARIOS[0].meses);
  const [contratos, setContratos] = useState(CENARIOS[0].contratos);
  const [imoveis, setImoveis] = useState(1);
  const [cenarioAtivo, setCenarioAtivo] = useState<string | null>(CENARIOS[0].nome);

  const faixa = faixaPorImoveisAtivos(imoveis);
  const gestor = ehPlanoGestor(imoveis);

  const calc = useMemo(() => {
    const taxa = faixa.taxa;
    const totalContratos = contratos * imoveis;
    const taxaPorContrato = valorTaxa(valorMes, taxa);
    const taxaAno = taxaPorContrato * totalContratos;
    const reservasAno = valorMes * meses * totalContratos;
    const donoViva = reservasAno - taxaAno;
    // % que a Viva fica de cada mês, em média, ao longo do contrato (a taxa é cobrada uma vez só).
    const pctMedioViva = meses > 0 ? taxa / meses : taxa;
    return { taxa, totalContratos, taxaPorContrato, taxaAno, reservasAno, donoViva, pctMedioViva };
  }, [faixa, valorMes, meses, contratos, imoveis]);

  function aplicarCenario(c: Cenario) {
    setValorMes(c.valorMes);
    setMeses(c.meses);
    setContratos(c.contratos);
    setCenarioAtivo(c.nome);
  }
  const textoImoveis = `${imoveis} ${imoveis === 1 ? "imóvel" : "imóveis"}`;

  // Quanto o dono fica no ano em cada canal (mesma receita bruta, % médio de cada um).
  const porCanal = [
    { label: "Viva Nomads", pct: calc.pctMedioViva, cor: C.forest },
    ...CANAIS.map((c, i) => ({ label: c.nome, pct: c.pct, cor: i % 2 === 0 ? C.sage : C.gold })),
  ].map((c) => ({ ...c, value: calc.reservasAno * (1 - c.pct) }));

  // Quanto a Viva fatura por faixa neste cenário (cada faixa usa a mesma carteira).
  const receitaPorFaixa = FAIXAS_COMISSAO_PADRAO.map((f) => ({
    label: f.maxImoveis === null ? "31+" : f.minImoveis === f.maxImoveis ? `${f.minImoveis}` : `${f.minImoveis}–${f.maxImoveis}`,
    value: valorTaxa(valorMes, f.taxa) * contratos * f.minImoveis,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`${styles.topbar} ${styles.noprint}`}>
          <Link className={styles.brand} href="/">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </Link>
        </div>

        <header className={styles.hero}>
          <h1 className={styles.h1}>Quanto sobra no bolso?</h1>
          <p className={styles.sub}>
            Uma regra só: <strong>taxa de serviço de {pctTexto(FAIXAS_COMISSAO_PADRAO[0].taxa)} por contrato fechado</strong>, sobre o
            primeiro mês. Quanto mais imóveis ativos, menor a taxa. Simule quanto o proprietário leva no ano e quanto a plataforma fatura.
          </p>
        </header>

        <div className={styles.keymsg}>
          <strong>Sem cobrança mensal fixa:</strong> a taxa é cobrada uma única vez por contrato fechado, do proprietário. A renovação conta
          como novo contrato. A Viva não recebe o dinheiro da reserva do imóvel nem da Caução.
        </div>

        {/* Cenários */}
        <div className={styles.card}>
          <h2>Cenários</h2>
          <div className={styles.tabs}>
            {CENARIOS.map((c) => (
              <button
                key={c.nome}
                type="button"
                className={`${styles.tab} ${cenarioAtivo === c.nome ? styles.active : ""}`}
                aria-pressed={cenarioAtivo === c.nome}
                onClick={() => aplicarCenario(c)}
              >
                <div className={styles.n}>{c.nome}</div>
                <div className={styles.d}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Controles */}
        <div className={styles.card}>
          <h2>Ajuste os números</h2>
          <Slider label="Valor do 1º mês" value={valorMes} min={1000} max={10000} step={100} display={brl(valorMes)}
            onChange={(v) => { setValorMes(v); setCenarioAtivo(null); }} />
          <Slider label="Duração de cada reserva" value={meses} min={1} max={6} step={1}
            display={`${meses} ${meses === 1 ? "mês" : "meses"}`}
            onChange={(v) => { setMeses(v); setCenarioAtivo(null); }} />
          <Slider label="Contratos fechados no ano (por imóvel)" value={contratos} min={1} max={6} step={1} display={`${contratos}×`}
            onChange={(v) => { setContratos(v); setCenarioAtivo(null); }} />
          <Slider label="Quantos imóveis você tem?" value={imoveis} min={1} max={40} step={1} display={textoImoveis}
            onChange={(v) => setImoveis(v)} />
        </div>

        {/* Resultado */}
        <div className={styles.results}>
          <div className={`${styles.result} ${styles.owner}`}>
            <h3>Proprietário · {textoImoveis} · no ano</h3>
            <div className={styles.headline}>{brl(calc.donoViva)}</div>
            <div className={styles.cap} data-testid="faixa-atual">
              fica no bolso com o Viva Nomads · taxa de {pctTexto(calc.taxa)}
              {gestor ? " (Plano Gestor: fale com a gente)" : ""}
            </div>
            <div className={styles.compare}>
              <span>No Airbnb ficaria</span>
              <span className={styles.amt}>{brl(calc.reservasAno * (1 - PCT_AIRBNB))}</span>
            </div>
            <p className={styles.note}>
              Em média a Viva fica com <b>{pct1(calc.pctMedioViva)}</b> de cada mês de uma reserva de {meses} {meses === 1 ? "mês" : "meses"},
              contra {pct1(PCT_AIRBNB)} do Airbnb.
            </p>
            <p className={styles.payback}>
              Cada contrato fechado gera uma taxa de <b>{brl(calc.taxaPorContrato)}</b> (primeiro mês × {pctTexto(calc.taxa)}).
            </p>
          </div>

          <div className={`${styles.result} ${styles.platform}`}>
            <h3>Viva Nomads · fatura no ano</h3>
            <div className={styles.headline}>{brl(calc.taxaAno)}</div>
            <div className={styles.cap}>taxa de serviço · {calc.totalContratos} {calc.totalContratos === 1 ? "contrato" : "contratos"}</div>
            <div className={styles.compare}>
              <span>Taxa por contrato</span>
              <span className={styles.amt}>{brl(calc.taxaPorContrato)}</span>
            </div>
            <p className={styles.note}>
              Receita da plataforma = contratos × valor do 1º mês × taxa da faixa. Sem assinatura nesta fase.
            </p>
          </div>
        </div>

        {/* Gráficos */}
        <div className={styles.charts}>
          <div className={`${styles.chartCard} ${styles.chartFull}`}>
            <h3>Quanto o proprietário fica no ano, por canal</h3>
            <p className={styles.chartSub}>Mesma receita bruta de {brl(calc.reservasAno)}, descontado o percentual médio de cada canal.</p>
            <SimpleBars bars={porCanal.map((c) => ({ label: c.label, value: c.value, color: c.cor }))} />
          </div>

          <div className={`${styles.chartCard} ${styles.chartFull}`}>
            <h3>Receita da Viva por faixa de imóveis</h3>
            <p className={styles.chartSub}>Com o mesmo cenário, no limite inferior de cada faixa (31+ segue em 6% até negociar).</p>
            <SimpleBars bars={receitaPorFaixa.map((c) => ({ label: c.label, value: c.value, color: C.forest }))} />
          </div>
        </div>

        {/* Faixas */}
        <div className={styles.card}>
          <h2>A taxa cai conforme você ativa mais imóveis</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {FAIXAS_COMISSAO_PADRAO.map((f) => (
                  <tr key={f.minImoveis} className={f.minImoveis === faixa.minImoveis ? styles.total : undefined}>
                    <td>{rotuloFaixa(f.minImoveis, f.maxImoveis)}</td>
                    <td>{f.gestor ? "Plano Gestor · fale com a gente" : pctTexto(f.taxa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Imóvel ativo = publicado e aprovado. A assinatura para donos com muitos imóveis é fase 2 (futuro).{" "}
            <a href={`mailto:${SUPORTE_EMAIL}?subject=Plano%20Gestor`}>Fale com a gente sobre o Plano Gestor.</a>
          </p>
        </div>

        {/* Premissas */}
        <div className={`${styles.card} ${styles.premissas}`}>
          <h2>Premissas</h2>
          <ul>
            <li>Taxa de serviço <strong>uma vez por contrato fechado</strong>, sobre o valor do 1º mês; renovação = novo contrato, com a taxa da faixa do dono.</li>
            <li>Faixas: <strong>{FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor).map((f) => pctTexto(f.taxa)).join(" / ")}</strong> e Plano Gestor a partir de 31 imóveis.</li>
            <li>O inquilino não paga taxa da Viva. A Viva não emite nota fiscal ao inquilino.</li>
            <li>
              Percentual médio dos canais (valores de referência {COMPARE_REFERENCIA}): {CANAIS.map((c) => `${c.nome} ${pct1(c.pct)}`).join("; ")}; fontes e datas na página de preços.
              O percentual da Viva é a taxa dividida pelos meses da reserva.
            </li>
            <li>O retorno líquido de anfitriões do Airbnb em Uberlândia fica abaixo de 1% ao mês (Airbtics/GuestFavorites 2025–26); não prometemos retorno.</li>
          </ul>
          <span className={styles.ill}>Valores ilustrativos — não são projeção contábil.</span>
        </div>

        <footer className={styles.footer}>
          Viva Nomads · simulador do modelo de negócio. Plataforma em fase de testes. Lançamento oficial em 2027.
        </footer>
      </div>
    </div>
  );
}

// ── Gráficos SVG (sem dependências) ─────────────────────────────────────────
const CHART_W = 600;
const CHART_H = 240;
const PAD_T = 24;
const PAD_B = 34;

function SimpleBars({ bars }: { bars: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plotH = CHART_H - PAD_T - PAD_B;
  const n = bars.length;
  const slot = CHART_W / n;
  const bw = Math.min(90, slot * 0.5);
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Comparação em barras">
      <line x1={0} y1={CHART_H - PAD_B} x2={CHART_W} y2={CHART_H - PAD_B} stroke={C.line} />
      {bars.map((b, i) => {
        const h = (Math.max(0, b.value) / max) * plotH;
        const x = i * slot + (slot - bw) / 2;
        const y = CHART_H - PAD_B - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} fill={b.color} rx="3" />
            <text x={x + bw / 2} y={y - 7} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.forest}>
              {brl(b.value)}
            </text>
            <text x={x + bw / 2} y={CHART_H - 12} textAnchor="middle" fontSize="11" fill={C.muted}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Slider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <div className={styles.slider}>
      <div className={styles.top}>
        <span className={styles.lbl}>{label}</span>
        <span className={styles.val}>{display}</span>
      </div>
      <input type="range" value={value} min={min} max={max} step={step} aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value) || min)} />
    </div>
  );
}
