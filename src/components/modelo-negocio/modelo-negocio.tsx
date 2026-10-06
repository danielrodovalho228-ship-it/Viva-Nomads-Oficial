"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./modelo-negocio.module.css";
import { PLANOS as PLANOS_CONFIG, GESTOR_PRECO, GESTOR_RESUMO, MERCADO, assinaturaAnualGestor, type PlanoId } from "@/config/planos";
import { custoAnualPorPlano, planoMaisBarato, textoIndisponivel } from "@/lib/comparativo-precos";
import { GraficoCustoPorImovel } from "@/components/precos/grafico-custo-por-imovel";

// ── CONSTANTES (fáceis de editar) ───────────────────────────────────────────
// Modelo HÍBRIDO: assinatura do plano + comissão que CAI por plano até ZERO no
// topo. A comissão é cobrada UMA vez, no fechamento, sobre o 1º mês de cada
// locação (não é mensal).
interface Plano {
  id: PlanoId;
  key: PlanoKey;
  nome: string;
  comissao: number; // fração sobre o 1º mês de cada locação
  subAno: number; // assinatura anual (R$)
}
type PlanoKey = "gratuito" | "essencial" | "profissional" | "gestor";

// Lido da FONTE ÚNICA (config/planos): comissão e assinatura de cada plano. A
// assinatura do Gestor depende da quantidade de imóveis (assinaturaAnualGestor).
const CHAVE_POR_ID: Record<string, PlanoKey> = {
  free: "gratuito",
  essential: "essencial",
  pro: "profissional",
  gestor: "gestor",
};
const PLANOS: Plano[] = PLANOS_CONFIG.map((p) => ({
  id: p.id,
  key: CHAVE_POR_ID[p.id],
  nome: p.nome,
  comissao: p.comissao,
  subAno: p.assinaturaAnual ?? assinaturaAnualGestor(GESTOR_PRECO.imoveisInclusos),
}));
/** Assinatura anual do plano para `imoveis` imóveis (só a do Gestor varia). */
const subAnoPara = (p: Plano, imoveis: number) => (p.id === "gestor" ? assinaturaAnualGestor(imoveis) : p.subAno);
const PLANO_BY_KEY = Object.fromEntries(PLANOS.map((p) => [p.key, p])) as Record<PlanoKey, Plano>;

const AIRBNB_IMPACTO = MERCADO.airbnbTaxa; // taxa do Airbnb para anfitriões (fonte única: config/planos)

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

// Preço e comissão dos cartões vêm da fonte única (nada fixo aqui).
function rotuloComissao(id: string): string {
  const c = PLANOS_CONFIG.find((p) => p.id === id)?.comissao ?? 0;
  return c === 0 ? "Comissão ZERO" : `Comissão ${Math.round(c * 1000) / 10}% de 1 aluguel`;
}
function precoMes(id: string): string {
  const v = PLANOS_CONFIG.find((p) => p.id === id)?.precoMensal;
  return v ? `R$ ${v}/mês` : "Sob consulta";
}
const precoGestor = GESTOR_PRECO.ligado ? `a partir de R$ ${GESTOR_PRECO.mensalBase}/mês` : "Sob consulta";

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
  contato?: boolean;
}[] = [
  {
    key: "gratuito",
    preco: "Grátis",
    comissaoLabel: rotuloComissao("free"),
    audience: "Para começar",
    features: ["1 anúncio ativo", "Contato pela plataforma", "Selo Pronto para Morar"],
    why: "Publique sem custo e teste a plataforma antes de assinar.",
  },
  {
    key: "essencial",
    preco: precoMes("essential"),
    comissaoLabel: rotuloComissao("essential"),
    audience: "Para quem aluga de vez em quando",
    tag: "Mais popular",
    variant: "featured",
    features: ["Até 5 anúncios", "Prioridade na busca", "Verificação do inquilino"],
    why: "O essencial para alugar com segurança e destaque.",
  },
  {
    key: "profissional",
    preco: precoMes("pro"),
    comissaoLabel: rotuloComissao("pro"),
    audience: "Para quem vive de locação",
    features: ["Até 20 anúncios", "Prioridade máxima na busca"],
    why: "Comissão menor e mais anúncios — escala com você.",
  },
  {
    key: "gestor",
    preco: precoGestor,
    comissaoLabel: "Comissão ZERO",
    audience: GESTOR_PRECO.ligado ? `Para carteiras de ${GESTOR_PRECO.minimoImoveis}+ imóveis` : "Administradoras e coordenadores",
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
    contato: true,
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
  const [imoveis, setImoveis] = useState(1);
  // null = segue o plano mais barato para a quantidade de imóveis.
  const [escolhido, setEscolhido] = useState<PlanoKey | null>(null);
  const [cenarioAtivo, setCenarioAtivo] = useState<string | null>(CENARIOS[0].nome);

  // Custo por plano = assinatura anual + comissão × aluguel × locações × imóveis.
  const custos = useMemo(() => custoAnualPorPlano(imoveis, locacoes * imoveis, aluguel), [imoveis, locacoes, aluguel]);
  const custoDe = (k: PlanoKey) => custos.find((c) => c.id === PLANO_BY_KEY[k].id)!;
  const maisBarato = CHAVE_POR_ID[planoMaisBarato(imoveis, locacoes * imoveis, aluguel)];
  const planoKey: PlanoKey = escolhido && custoDe(escolhido).disponivel ? escolhido : maisBarato;
  const plano = PLANO_BY_KEY[planoKey];
  const subAno = subAnoPara(plano, imoveis);

  const calc = useMemo(() => {
    const aluguelAno = aluguel * meses * locacoes * imoveis;
    const comissao = aluguel * plano.comissao * locacoes * imoveis;
    const propVN = aluguelAno - comissao - subAno;
    const propAirbnb = aluguelAno * (1 - AIRBNB_IMPACTO);
    const platTotal = comissao + subAno;
    const platAssinatura = subAno;
    const diasParaPagar = subAno === 0 ? 0 : Math.ceil(subAno / ((aluguel * imoveis) / 30));
    return { aluguelAno, comissao, propVN, propAirbnb, platTotal, platAssinatura, diasParaPagar };
  }, [aluguel, meses, locacoes, imoveis, plano, subAno]);

  function aplicarCenario(c: Cenario) {
    setAluguel(c.aluguel);
    setMeses(c.meses);
    setLocacoes(c.locacoes);
    setCenarioAtivo(c.nome);
    setEscolhido(null);
  }
  const textoImoveis = `${imoveis} ${imoveis === 1 ? "imóvel" : "imóveis"}`;
  const totalMaisBarato = custoDe(maisBarato).total;

  const diffOwner = calc.propVN - calc.propAirbnb;
  const vnGanha = diffOwner >= 0;

  // Gráfico B: receita da plataforma por plano (mesmo cenário atual).
  const platPorPlano = PLANOS.filter((p) => custoDe(p.key).disponivel).map((p) => ({
    label: p.nome,
    assinatura: subAnoPara(p, imoveis),
    comissao: aluguel * p.comissao * locacoes * imoveis,
  }));
  // Gráfico C: proprietário nos 4 cenários, no plano selecionado.
  const propPorCenario = CENARIOS.map((c) => ({
    label: c.nome.split(" ")[0],
    value: (c.aluguel * c.meses * c.locacoes - c.aluguel * plano.comissao * c.locacoes) * imoveis - subAno,
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
          <Slider label="Locações no ano (por imóvel)" value={locacoes} min={1} max={6} step={1} display={`${locacoes}×`}
            onChange={(v) => { setLocacoes(v); setCenarioAtivo(null); }} />
          <Slider label="Quantos imóveis você tem?" value={imoveis} min={1} max={30} step={1} display={textoImoveis}
            onChange={(v) => { setImoveis(v); setEscolhido(null); }} />

          <div style={{ marginTop: 14 }}>
            <div className={styles.top} style={{ marginBottom: 8 }}>
              <span className={styles.lbl}>Plano do proprietário</span>
            </div>
            <div className={styles.planSelect} role="tablist" aria-label="Plano">
              {PLANOS.map((p) => {
                const c = custoDe(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="tab"
                    aria-selected={planoKey === p.key}
                    disabled={!c.disponivel}
                    data-testid={`plano-${p.id}`}
                    className={`${styles.planBtn} ${planoKey === p.key ? styles.active : ""}`}
                    onClick={() => setEscolhido(p.key)}
                  >
                    {p.nome}
                    {c.disponivel && p.key === maisBarato && <span className={styles.barato}>Mais barato para você</span>}
                    <small>
                      {!c.disponivel
                        ? textoIndisponivel(c, imoveis)
                        : `${brl(c.total ?? 0)}/ano · ${p.comissao === 0 ? "comissão zero" : `comissão de ${Math.round(p.comissao * 1000) / 10}% de 1 aluguel`}`}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className={styles.results}>
          <div className={`${styles.result} ${styles.owner}`}>
            <h3>Proprietário · {textoImoveis} · no ano ({plano.nome})</h3>
            <div className={styles.headline}>{brl(calc.propVN)}</div>
            <div className={styles.cap}>fica no bolso com o Viva Nomads</div>
            <div className={styles.compare}>
              <span>No Airbnb ficaria</span>
              <span className={styles.amt}>{brl(calc.propAirbnb)}</span>
            </div>
            {totalMaisBarato !== null && (
              <p className={styles.note} data-testid="mais-barato">
                Com {textoImoveis}, o <b>{PLANO_BY_KEY[maisBarato].nome}</b> sai mais barato: <b>{brl(totalMaisBarato)}</b> no ano.
              </p>
            )}
            <p className={styles.note}>
              {vnGanha ? (
                <>Fica com <b>{brl(diffOwner)}</b> a mais no ano do que no Airbnb — com contrato e caução documentada.</>
              ) : (
                <>O Airbnb deixaria <b>{brl(-diffOwner)}</b> a mais, mas sem contrato nem caução documentada.</>
              )}
            </p>
            <p className={styles.payback}>
              {subAno === 0 ? (
                <>Sem assinatura, nada a recuperar — a plataforma cobra só a comissão de {Math.round(plano.comissao * 1000) / 10}% de 1 aluguel, uma vez por contrato.</>
              ) : (
                <>A assinatura de <b>{brl(subAno)}/ano</b> se paga com <b>{calc.diasParaPagar} {calc.diasParaPagar === 1 ? "dia" : "dias"}</b> de aluguel {imoveis === 1 ? "deste imóvel" : `dos ${imoveis} imóveis`}.</>
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
            <GraficoCustoPorImovel aluguel={aluguel} meses={meses} locacoes={locacoes} imoveis={imoveis} plano={plano.id} />
          </div>

          <div className={`${styles.chartCard} ${styles.chartFull}`}>
            <h3>Proprietário nos 4 cenários · {plano.nome} · {textoImoveis}</h3>
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
                {pc.contato && GESTOR_PRECO.ligado && (
                  <a className={styles.pcontato} href="mailto:contato@vivanomads.com.br?subject=Plano%20Gestor">
                    Fale com a gente
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Premissas */}
        <div className={`${styles.card} ${styles.premissas}`}>
          <h2>Premissas</h2>
          <ul>
            <li>Comissão cobrada <strong>uma vez</strong>, sobre o 1º mês de cada locação: <strong>{PLANOS_CONFIG.map((p) => `${Math.round(p.comissao * 1000) / 10}%`).join(" / ")}</strong> (Gratuito → Gestor).</li>
            <li>
              Assinatura anual por plano:{" "}
              <strong>{PLANOS.map((p) => (p.subAno === 0 ? "R$ 0" : p.subAno.toLocaleString("pt-BR"))).join(" / ")}</strong>{" "}
              (Gestor: {GESTOR_RESUMO}; {GESTOR_PRECO.imoveisInclusos} imóveis incluídos e R$ {GESTOR_PRECO.porImovelAdicional}/mês por imóvel adicional).
            </li>
            <li>Custo do plano no ano = assinatura anual + comissão × aluguel × locações × imóveis. Plano acima do limite de anúncios não entra; empate fica com o plano mais simples.</li>
            <li>Taxa do Airbnb para anfitriões: <strong>{Math.round(AIRBNB_IMPACTO * 100)}%</strong> ({MERCADO.airbnbFonte})</li>
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
