"use client";

import { useMemo, useState } from "react";
import styles from "./modelo-negocio.module.css";

// ── CONSTANTES (fáceis de editar) ───────────────────────────────────────────
// Modelo HÍBRIDO: assinatura do plano + comissão que CAI por plano até ZERO no
// topo. A comissão é cobrada UMA vez, no fechamento, sobre o 1º mês de cada
// locação (não é mensal).
interface Plano {
  key: PlanoKey;
  nome: string;
  comissao: number; // fração sobre o 1º mês de cada locação
  subAno: number; // assinatura anual (R$)
}
type PlanoKey = "gratuito" | "essencial" | "profissional" | "gestor";

const PLANOS: Plano[] = [
  { key: "gratuito", nome: "Gratuito", comissao: 0.12, subAno: 0 },
  { key: "essencial", nome: "Essencial", comissao: 0.1, subAno: 588 }, // R$49/mês
  { key: "profissional", nome: "Profissional", comissao: 0.08, subAno: 1548 }, // R$129/mês
  { key: "gestor", nome: "Gestor", comissao: 0.0, subAno: 3000 }, // sob consulta (estimado)
];
const PLANO_BY_KEY = Object.fromEntries(PLANOS.map((p) => [p.key, p])) as Record<PlanoKey, Plano>;

const AIRBNB_IMPACTO = 0.14; // impacto total do Airbnb sobre o aluguel (ref. mercado)

interface Cenario {
  nome: string;
  desc: string;
  aluguel: number;
  meses: number;
  locacoes: number;
}
const CENARIOS: Cenario[] = [
  { nome: "Residência médica", desc: "R$ 3.000 · 6 meses · 2×/ano", aluguel: 3000, meses: 6, locacoes: 2 },
  { nome: "Feira / projeto curto", desc: "R$ 2.500 · 2 meses · 4×/ano", aluguel: 2500, meses: 2, locacoes: 4 },
  { nome: "Executivo relocado", desc: "R$ 5.000 · 4 meses · 2×/ano", aluguel: 5000, meses: 4, locacoes: 2 },
  { nome: "Estúdio econômico", desc: "R$ 1.800 · 3 meses · 3×/ano", aluguel: 1800, meses: 3, locacoes: 3 },
];

// Cartões da seção de planos (foco em vantagem, não em preço).
const PLAN_CARDS: {
  key: PlanoKey;
  preco: string;
  comissaoLabel: string;
  audience: string;
  tag?: string;
  variant?: "featured" | "gestor";
  features: string[];
  why: string;
}[] = [
  {
    key: "gratuito",
    preco: "Grátis",
    comissaoLabel: "Comissão 12%",
    audience: "Para começar",
    features: ["1 anúncio ativo", "Contato pela plataforma", "Selo Pronto para Morar"],
    why: "Publique sem custo e teste a plataforma antes de assinar.",
  },
  {
    key: "essencial",
    preco: "R$ 49/mês",
    comissaoLabel: "Comissão 10%",
    audience: "Para quem aluga de vez em quando",
    tag: "Mais popular",
    variant: "featured",
    features: ["Até 5 anúncios", "Prioridade na busca", "Verificação do inquilino"],
    why: "O essencial para alugar com segurança e destaque.",
  },
  {
    key: "profissional",
    preco: "R$ 129/mês",
    comissaoLabel: "Comissão 8%",
    audience: "Para quem vive de locação",
    features: ["Até 20 anúncios", "Prioridade máxima na busca", "Contrato digital com validade jurídica incluído"],
    why: "Contrato incluído e comissão menor — escala com você.",
  },
  {
    key: "gestor",
    preco: "Sob consulta",
    comissaoLabel: "Comissão ZERO",
    audience: "Administradoras e coordenadores",
    tag: "Comissão ZERO",
    variant: "gestor",
    features: [
      "Imóveis ilimitados",
      "Gestão de carteira",
      "Múltiplos proprietários",
      "Atendimento dedicado",
      "Contratos ilimitados",
      "Relatórios de carteira",
    ],
    why:
      "100% do aluguel fica com o proprietário — a plataforma vive só da assinatura, como o Furnished Finder. É o plano que menos parece imobiliária.",
  },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Cores da marca para os gráficos.
const C = { forest: "#0f3d2e", sage: "#5a8a6b", gold: "#c8a24b", line: "#e3e9e5", muted: "#6b7280" };

export function ModeloNegocio() {
  const [aluguel, setAluguel] = useState(CENARIOS[0].aluguel);
  const [meses, setMeses] = useState(CENARIOS[0].meses);
  const [locacoes, setLocacoes] = useState(CENARIOS[0].locacoes);
  const [planoKey, setPlanoKey] = useState<PlanoKey>("essencial");
  const [cenarioAtivo, setCenarioAtivo] = useState<string | null>(CENARIOS[0].nome);

  const plano = PLANO_BY_KEY[planoKey];

  const calc = useMemo(() => {
    const aluguelAno = aluguel * meses * locacoes;
    const comissao = aluguel * plano.comissao * locacoes;
    const propVN = aluguelAno - comissao - plano.subAno;
    const propAirbnb = aluguelAno * (1 - AIRBNB_IMPACTO);
    const platTotal = comissao + plano.subAno;
    const platAssinatura = plano.subAno;
    const diasParaPagar = plano.subAno === 0 ? 0 : Math.ceil(plano.subAno / (aluguel / 30));
    return { aluguelAno, comissao, propVN, propAirbnb, platTotal, platAssinatura, diasParaPagar };
  }, [aluguel, meses, locacoes, plano]);

  function aplicarCenario(c: Cenario) {
    setAluguel(c.aluguel);
    setMeses(c.meses);
    setLocacoes(c.locacoes);
    setCenarioAtivo(c.nome);
  }

  const diffOwner = calc.propVN - calc.propAirbnb;
  const vnGanha = diffOwner >= 0;

  // Gráfico B: receita da plataforma por plano (mesmo cenário atual).
  const platPorPlano = PLANOS.map((p) => ({
    label: p.nome,
    assinatura: p.subAno,
    comissao: aluguel * p.comissao * locacoes,
  }));
  // Gráfico C: proprietário nos 4 cenários, no plano selecionado.
  const propPorCenario = CENARIOS.map((c) => ({
    label: c.nome.split(" ")[0],
    value: c.aluguel * c.meses * c.locacoes - c.aluguel * plano.comissao * c.locacoes - plano.subAno,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`${styles.topbar} ${styles.noprint}`}>
          <a className={styles.brand} href="/home">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </a>
        </div>

        <header className={styles.hero}>
          <h1 className={styles.h1}>Quanto sobra no bolso?</h1>
          <p className={styles.sub}>
            Modelo de receita <strong>híbrido</strong>: assinatura do plano + comissão que cai a cada
            plano até <strong>zero</strong> no topo. Simule quanto o proprietário leva no ano e quanto
            a plataforma fatura.
          </p>
        </header>

        <div className={styles.keymsg}>
          <strong>Não somos imobiliária:</strong> a comissão é cobrada uma única vez, no fechamento, e
          chega a zero no plano topo. Somos plataforma de serviços.
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
          <Slider label="Aluguel mensal" value={aluguel} min={1000} max={10000} step={100} display={brl(aluguel)}
            onChange={(v) => { setAluguel(v); setCenarioAtivo(null); }} />
          <Slider label="Prazo de cada locação" value={meses} min={1} max={6} step={1}
            display={`${meses} ${meses === 1 ? "mês" : "meses"}`}
            onChange={(v) => { setMeses(v); setCenarioAtivo(null); }} />
          <Slider label="Locações no ano" value={locacoes} min={1} max={6} step={1} display={`${locacoes}×`}
            onChange={(v) => { setLocacoes(v); setCenarioAtivo(null); }} />

          <div style={{ marginTop: 14 }}>
            <div className={styles.top} style={{ marginBottom: 8 }}>
              <span className={styles.lbl}>Plano do proprietário</span>
            </div>
            <div className={styles.planSelect} role="tablist" aria-label="Plano">
              {PLANOS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={planoKey === p.key}
                  className={`${styles.planBtn} ${planoKey === p.key ? styles.active : ""}`}
                  onClick={() => setPlanoKey(p.key)}
                >
                  {p.nome}
                  <small>{p.comissao === 0 ? "0% comissão" : `${Math.round(p.comissao * 100)}% comissão`}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className={styles.results}>
          <div className={`${styles.result} ${styles.owner}`}>
            <h3>Proprietário · no ano ({plano.nome})</h3>
            <div className={styles.headline}>{brl(calc.propVN)}</div>
            <div className={styles.cap}>fica no bolso com o Viva Nomads</div>
            <div className={styles.compare}>
              <span>No Airbnb ficaria</span>
              <span className={styles.amt}>{brl(calc.propAirbnb)}</span>
            </div>
            <p className={styles.note}>
              {vnGanha ? (
                <>Fica com <b>{brl(diffOwner)}</b> a mais no ano do que no Airbnb — com contrato, verificação e garantia.</>
              ) : (
                <>O Airbnb deixaria <b>{brl(-diffOwner)}</b> a mais, mas sem contrato, verificação nem garantia.</>
              )}
            </p>
            <p className={styles.payback}>
              {plano.subAno === 0 ? (
                <>Sem assinatura, nada a recuperar — a plataforma cobra só a comissão de {Math.round(plano.comissao * 100)}%.</>
              ) : (
                <>A assinatura de <b>{brl(plano.subAno)}/ano</b> se paga com <b>{calc.diasParaPagar} dias</b> de aluguel deste imóvel. Uma locação já cobre o ano inteiro.</>
              )}
            </p>
          </div>

          <div className={`${styles.result} ${styles.platform}`}>
            <h3>Viva Nomads · fatura no ano ({plano.nome})</h3>
            <div className={styles.headline}>{brl(calc.platTotal)}</div>
            <div className={styles.cap}>assinatura + comissão</div>
            <div className={styles.compare}>
              <span>Só assinatura</span>
              <span className={styles.amt}>{brl(calc.platAssinatura)}</span>
            </div>
            <p className={styles.note}>
              {plano.comissao === 0 ? (
                <>No plano topo a comissão é <b>zero</b>: vive só da assinatura, como o Furnished Finder — não é imobiliária.</>
              ) : (
                <>A comissão (uma vez, no fechamento) adiciona <b>{brl(calc.comissao)}</b>/ano; cai a cada plano até zero no Gestor.</>
              )}
            </p>
          </div>
        </div>

        {/* Gráficos */}
        <div className={styles.charts}>
          <div className={styles.chartCard}>
            <h3>Proprietário neste cenário</h3>
            <p className={styles.chartSub}>Quanto sobra no ano — {plano.nome} × Airbnb × aluguel bruto.</p>
            <SimpleBars
              bars={[
                { label: "Viva Nomads", value: calc.propVN, color: C.forest },
                { label: "Airbnb", value: calc.propAirbnb, color: C.sage },
                { label: "Bruto", value: calc.aluguelAno, color: C.gold },
              ]}
            />
          </div>

          <div className={styles.chartCard}>
            <h3>Receita da plataforma por plano</h3>
            <p className={styles.chartSub}>Assinatura + comissão — a comissão encolhe até zero no Gestor.</p>
            <StackedBars groups={platPorPlano} />
            <div className={styles.chartLegend}>
              <span><span className={styles.sw} style={{ background: C.forest }} />Assinatura</span>
              <span><span className={styles.sw} style={{ background: C.gold }} />Comissão</span>
            </div>
          </div>

          <div className={`${styles.chartCard} ${styles.chartFull}`}>
            <h3>Proprietário nos 4 cenários · {plano.nome}</h3>
            <p className={styles.chartSub}>Quanto fica no bolso no ano, no plano selecionado.</p>
            <SimpleBars bars={propPorCenario.map((c) => ({ label: c.label, value: c.value, color: C.forest }))} />
          </div>
        </div>

        {/* Seção de planos */}
        <div className={styles.card}>
          <h2>Planos — o híbrido que não parece imobiliária</h2>
          <div className={styles.plans}>
            {PLAN_CARDS.map((pc) => (
              <div key={pc.key} className={`${styles.plan} ${pc.variant ? styles[pc.variant] : ""}`}>
                {pc.tag && <span className={styles.tag}>{pc.tag}</span>}
                <div className={styles.pname}>{PLANO_BY_KEY[pc.key].nome}</div>
                <div className={styles.paudience}>{pc.audience}</div>
                <div className={styles.pprice}>{pc.preco}</div>
                <div className={styles.pcom}>{pc.comissaoLabel}</div>
                <ul>
                  {pc.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className={styles.pwhy}>{pc.why}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Premissas */}
        <div className={`${styles.card} ${styles.premissas}`}>
          <h2>Premissas</h2>
          <ul>
            <li>Comissão cobrada <strong>uma vez</strong>, sobre o 1º mês de cada locação: <strong>12% / 10% / 8% / 0%</strong> (Gratuito → Gestor).</li>
            <li>Assinatura anual por plano: <strong>R$ 0 / 588 / 1.548 / 3.000</strong>.</li>
            <li>Impacto do Airbnb sobre o aluguel: <strong>~14%</strong> (referência de mercado).</li>
            <li>“Só assinatura” = comissão zero (plano topo / modelo Furnished Finder).</li>
          </ul>
          <span className={styles.ill}>Valores ilustrativos — não são projeção contábil.</span>
        </div>

        <footer className={styles.footer}>
          Viva Nomads · simulador de modelo de negócio (híbrido). Números ilustrativos, não constituem
          promessa de resultado.
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
            <text x={x + bw / 2} y={y - 7} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.forest}>
              {brl(b.value)}
            </text>
            <text x={x + bw / 2} y={CHART_H - 12} textAnchor="middle" fontSize="12" fill={C.muted}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StackedBars({ groups }: { groups: { label: string; assinatura: number; comissao: number }[] }) {
  const totals = groups.map((g) => g.assinatura + g.comissao);
  const max = Math.max(1, ...totals);
  const plotH = CHART_H - PAD_T - PAD_B;
  const n = groups.length;
  const slot = CHART_W / n;
  const bw = Math.min(80, slot * 0.5);
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Receita da plataforma por plano">
      <line x1={0} y1={CHART_H - PAD_B} x2={CHART_W} y2={CHART_H - PAD_B} stroke={C.line} />
      {groups.map((g, i) => {
        const hA = (g.assinatura / max) * plotH;
        const hC = (g.comissao / max) * plotH;
        const x = i * slot + (slot - bw) / 2;
        const base = CHART_H - PAD_B;
        const total = g.assinatura + g.comissao;
        return (
          <g key={i}>
            <rect x={x} y={base - hA} width={bw} height={hA} fill={C.forest} rx="2" />
            <rect x={x} y={base - hA - hC} width={bw} height={hC} fill={C.gold} rx="2" />
            <text x={x + bw / 2} y={base - hA - hC - 7} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={C.forest}>
              {brl(total)}
            </text>
            <text x={x + bw / 2} y={CHART_H - 12} textAnchor="middle" fontSize="12" fill={C.muted}>
              {g.label}
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
