"use client";

import { useMemo, useState } from "react";
import { assinaturaMediaMix } from "@/config/planos";
import styles from "./roi.module.css";

// ── CONSTANTES (editáveis) ───────────────────────────────────────────────────
const CUSTO_VAR_PROP = 15; // custo variável por proprietário/mês
const ALUGUEL_MEDIO = 3000;
const MESES = 36;
const AQUISICAO_NOVA = 3; // +3 proprietários novos por mês

// Defaults das premissas (calibrados para uma história plausível de startup).
const DEFAULTS = {
  invest: 80000, // investimento inicial (R$)
  custoFixo: 8000, // custo fixo mensal (R$)
  marketing: 4000, // marketing mensal (R$)
  propsMes1: 10, // proprietários no mês 1
  cresc: 8, // crescimento mensal (%)
  churn: 3, // churn mensal (%)
  // Assinatura média (R$/mês) DERIVADA do mix declarado dos planos (C3):
  // 50% Gratuito, 35% Essencial, 15% Profissional (ver config/planos.ts).
  // Editável no slider; a nota abaixo aponta a referência.
  assin: assinaturaMediaMix(),
  locAno: 3, // locações por proprietário/ano
  comissao: 8, // comissão média (%)
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const C = { forest: "#0f3d2e", sage: "#5a8a6b", gold: "#c8a24b", line: "#e3e9e5", muted: "#6b7280", danger: "#c0392b" };

interface Mes {
  m: number;
  props: number;
  receita: number;
  custo: number;
  lucro: number;
  caixa: number;
}

export function Roi() {
  const [p, setP] = useState(DEFAULTS);
  const set = (k: keyof typeof DEFAULTS, v: number) => setP((s) => ({ ...s, [k]: v }));

  const model = useMemo(() => {
    let props = p.propsMes1;
    let caixa = -p.invest;
    let breakeven: number | null = null;
    let payback: number | null = null;
    const meses: Mes[] = [];
    for (let m = 1; m <= MESES; m++) {
      const receita = props * p.assin + props * (p.locAno / 12) * ALUGUEL_MEDIO * (p.comissao / 100);
      const custo = p.custoFixo + p.marketing + props * CUSTO_VAR_PROP;
      const lucro = receita - custo;
      caixa += lucro;
      if (lucro >= 0 && breakeven === null) breakeven = m;
      if (caixa >= 0 && payback === null) payback = m;
      meses.push({ m, props, receita, custo, lucro, caixa });
      props = props * (1 + p.cresc / 100) * (1 - p.churn / 100) + AQUISICAO_NOVA;
    }
    const caixaFinal = caixa;
    const roi = p.invest > 0 ? (caixaFinal / p.invest) * 100 : 0;
    // Resumo anual (meses 1-12, 13-24, 25-36).
    const anos = [0, 1, 2].map((a) => {
      const fatia = meses.slice(a * 12, a * 12 + 12);
      const receita = fatia.reduce((s, x) => s + x.receita, 0);
      const custo = fatia.reduce((s, x) => s + x.custo, 0);
      return { ano: a + 1, propsFim: Math.round(fatia[fatia.length - 1].props), receita, custo, resultado: receita - custo };
    });
    return { meses, breakeven, payback, caixaFinal, roi, anos };
  }, [p]);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <a className={styles.brand} href="/home">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </a>
        </div>

        <div className={styles.warn}>
          <strong>Números ilustrativos.</strong> As premissas são estimativas de mercado para uma
          startup deste tipo, não a realidade do Viva Nomads. Ajuste para os seus números.
        </div>

        <header className={styles.hero}>
          <h1 className={styles.h1}>Quando o negócio se paga?</h1>
          <p className={styles.sub}>
            Modelo financeiro da empresa em 36 meses: payback (quando o caixa vira positivo),
            break-even mensal e ROI. Ajuste as premissas — tudo recalcula na hora.
          </p>
        </header>

        {/* KPIs */}
        <div className={styles.kpis}>
          <Kpi
            k="Payback"
            v={model.payback ? `Mês ${model.payback}` : "> 36 meses"}
            hint="caixa acumulado vira positivo"
            color={C.forest}
          />
          <Kpi
            k="Break-even mensal"
            v={model.breakeven ? `Mês ${model.breakeven}` : "> 36 meses"}
            hint="lucro do mês vira positivo"
            color={C.sage}
          />
          <Kpi
            k="Caixa em 36 meses"
            v={brl(model.caixaFinal)}
            hint="posição de caixa acumulada"
            color={model.caixaFinal >= 0 ? C.forest : C.danger}
          />
          <Kpi
            k="ROI em 36 meses"
            v={`${Math.round(model.roi)}%`}
            hint="caixa final ÷ investimento"
            color={model.roi >= 0 ? C.gold : C.danger}
          />
        </div>

        {/* Premissas */}
        <div className={styles.panels}>
          <div className={styles.card}>
            <h2>Investimento e custos</h2>
            <p className={styles.cardHelp}>Quanto entra de caixa e quanto sai todo mês.</p>
            <Slider label="Investimento inicial" value={p.invest} min={0} max={200000} step={5000} display={brl(p.invest)} onChange={(v) => set("invest", v)} />
            <Slider label="Custo fixo mensal" value={p.custoFixo} min={2000} max={30000} step={500} display={brl(p.custoFixo)} onChange={(v) => set("custoFixo", v)} />
            <Slider label="Marketing mensal" value={p.marketing} min={0} max={30000} step={500} display={brl(p.marketing)} onChange={(v) => set("marketing", v)} />
          </div>
          <div className={styles.card}>
            <h2>Crescimento e receita</h2>
            <p className={styles.cardHelp}>Como a base de proprietários e a receita evoluem.</p>
            <Slider label="Proprietários no mês 1" value={p.propsMes1} min={1} max={30} step={1} display={String(p.propsMes1)} onChange={(v) => set("propsMes1", v)} />
            <Slider label="Crescimento mensal" value={p.cresc} min={0} max={25} step={1} display={`${p.cresc}%`} onChange={(v) => set("cresc", v)} />
            <Slider label="Churn mensal" value={p.churn} min={0} max={15} step={1} display={`${p.churn}%`} onChange={(v) => set("churn", v)} />
            <Slider label="Assinatura média" value={p.assin} min={30} max={200} step={1} display={`${brl(p.assin)}/mês`} onChange={(v) => set("assin", v)} />
            <p className={styles.cardHelp}>
              Referência: mix dos planos (config/planos.ts) — 50% Gratuito, 35% Essencial, 15%
              Profissional. Editável acima.
            </p>
            <Slider label="Locações por proprietário/ano" value={p.locAno} min={1} max={6} step={1} display={`${p.locAno}×`} onChange={(v) => set("locAno", v)} />
            <Slider label="Comissão média" value={p.comissao} min={0} max={12} step={1} display={`${p.comissao}%`} onChange={(v) => set("comissao", v)} />
          </div>
        </div>

        {/* Gráficos */}
        <div className={styles.charts}>
          <div className={styles.chartCard}>
            <h3>Caixa acumulado (36 meses)</h3>
            <p className={styles.chartSub}>A linha cruza o zero no payback{model.payback ? ` (mês ${model.payback})` : ""}.</p>
            <CaixaChart meses={model.meses} payback={model.payback} />
          </div>
          <div className={styles.chartCard}>
            <h3>Receita × custo por mês</h3>
            <p className={styles.chartSub}>O cruzamento é o break-even{model.breakeven ? ` (mês ${model.breakeven})` : ""}.</p>
            <ReceitaCustoChart meses={model.meses} breakeven={model.breakeven} />
            <div className={styles.legend}>
              <span><span className={styles.sw} style={{ background: C.forest }} />Receita</span>
              <span><span className={styles.sw} style={{ background: C.gold }} />Custo</span>
            </div>
          </div>
        </div>

        {/* Resumo anual */}
        <div className={styles.card} style={{ marginTop: 16 }}>
          <h2>Resumo anual</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th className={styles.num}>Proprietários no fim</th>
                  <th className={styles.num}>Receita</th>
                  <th className={styles.num}>Custo</th>
                  <th className={styles.num}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {model.anos.map((a) => (
                  <tr key={a.ano}>
                    <td>Ano {a.ano}</td>
                    <td className={styles.num}>{a.propsFim}</td>
                    <td className={styles.num}>{brl(a.receita)}</td>
                    <td className={styles.num}>{brl(a.custo)}</td>
                    <td className={`${styles.num} ${a.resultado >= 0 ? styles.pos : styles.neg}`}>{brl(a.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Metodologia */}
        <div className={`${styles.card} ${styles.method}`}>
          <h2>Como o modelo funciona</h2>
          <ul>
            <li>A cada mês: <code>receita = props × assinatura + props × (locações/12) × R$ 3.000 × comissão</code>.</li>
            <li><code>custo = custo fixo + marketing + props × R$ {CUSTO_VAR_PROP}</code> (custo variável por proprietário).</li>
            <li><code>lucro = receita − custo</code>; o <strong>caixa</strong> acumula o lucro (começa em −investimento).</li>
            <li><strong>Break-even mensal</strong> = 1º mês com lucro ≥ 0. <strong>Payback</strong> = 1º mês com caixa ≥ 0.</li>
            <li>A base cresce: <code>props × (1 + crescimento) × (1 − churn) + {AQUISICAO_NOVA}</code> novos por mês.</li>
            <li><strong>ROI 36m</strong> = caixa final ÷ investimento inicial.</li>
          </ul>
          <p className={styles.cardHelp} style={{ marginTop: 10 }}>
            Valores ilustrativos — estimativas de mercado, não projeção contábil do Viva Nomads.
          </p>
        </div>

        <footer className={styles.footer}>
          Viva Nomads · modelo financeiro da empresa. Números ilustrativos, não constituem projeção.
        </footer>
      </div>
    </div>
  );
}

function Kpi({ k, v, hint, color }: { k: string; v: string; hint: string; color: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.k}>{k}</div>
      <div className={styles.v} style={{ color }}>{v}</div>
      <div className={styles.hint}>{hint}</div>
    </div>
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

// ── Gráficos SVG (sem dependências) ─────────────────────────────────────────
const W = 560;
const H = 220;
const PADX = 8;
const PADT = 12;
const PADB = 22;

function xAt(i: number, n: number) {
  return PADX + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * PADX));
}
function labelsX(meses: Mes[]) {
  const n = meses.length;
  return [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map((i) => ({ x: xAt(i, n), m: meses[i].m }));
}

/** Caixa acumulado — linha que pode ficar negativa, com o zero destacado. */
function CaixaChart({ meses, payback }: { meses: Mes[]; payback: number | null }) {
  const n = meses.length;
  const vals = meses.map((x) => x.caixa);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;
  const plotH = H - PADT - PADB;
  const yAt = (v: number) => PADT + (1 - (v - min) / span) * plotH;
  const zeroY = yAt(0);
  const pts = meses.map((x, i) => `${xAt(i, n).toFixed(1)},${yAt(x.caixa).toFixed(1)}`).join(" ");
  const area = `${xAt(0, n).toFixed(1)},${zeroY.toFixed(1)} ${pts} ${xAt(n - 1, n).toFixed(1)},${zeroY.toFixed(1)}`;
  const pbX = payback ? xAt(payback - 1, n) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Caixa acumulado nos 36 meses">
      <polygon points={area} fill="#0f3d2e" fillOpacity="0.08" />
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke={C.muted} strokeDasharray="4 4" />
      <text x={PADX} y={zeroY - 4} fontSize="10" fill={C.muted}>R$ 0</text>
      <polyline fill="none" stroke={C.forest} strokeWidth="2.5" points={pts} />
      {pbX != null && (
        <>
          <line x1={pbX} y1={PADT} x2={pbX} y2={H - PADB} stroke={C.gold} strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={pbX} cy={zeroY} r="4" fill={C.gold} />
        </>
      )}
      {labelsX(meses).map((l, i) => (
        <text key={i} x={l.x} y={H - 6} textAnchor="middle" fontSize="10" fill={C.muted}>m{l.m}</text>
      ))}
    </svg>
  );
}

/** Receita × custo por mês — duas linhas; o cruzamento é o break-even. */
function ReceitaCustoChart({ meses, breakeven }: { meses: Mes[]; breakeven: number | null }) {
  const n = meses.length;
  const max = Math.max(1, ...meses.map((x) => Math.max(x.receita, x.custo)));
  const plotH = H - PADT - PADB;
  const yAt = (v: number) => PADT + (1 - v / max) * plotH;
  const line = (key: "receita" | "custo") => meses.map((x, i) => `${xAt(i, n).toFixed(1)},${yAt(x[key]).toFixed(1)}`).join(" ");
  const beX = breakeven ? xAt(breakeven - 1, n) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receita e custo por mês">
      <line x1={0} y1={H - PADB} x2={W} y2={H - PADB} stroke={C.line} />
      {beX != null && (
        <line x1={beX} y1={PADT} x2={beX} y2={H - PADB} stroke={C.sage} strokeWidth="1.5" strokeDasharray="3 3" />
      )}
      <polyline fill="none" stroke={C.gold} strokeWidth="2" points={line("custo")} />
      <polyline fill="none" stroke={C.forest} strokeWidth="2.5" points={line("receita")} />
      {labelsX(meses).map((l, i) => (
        <text key={i} x={l.x} y={H - 6} textAnchor="middle" fontSize="10" fill={C.muted}>m{l.m}</text>
      ))}
    </svg>
  );
}
