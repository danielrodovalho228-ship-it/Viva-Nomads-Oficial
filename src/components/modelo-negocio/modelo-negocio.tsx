"use client";

import { useMemo, useState } from "react";
import styles from "./modelo-negocio.module.css";

// ── CONSTANTES (fáceis de editar) ───────────────────────────────────────────
const SUB_ANUAL = 588; // assinatura anual do proprietário (plano Essencial R$49/mês)
const COMISSAO = 0.1; // comissão VN sobre o 1º mês de cada locação (Essencial)
const AIRBNB_IMPACTO = 0.14; // impacto total do Airbnb sobre o aluguel (ref. de mercado)

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

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ModeloNegocio() {
  const [aluguel, setAluguel] = useState(CENARIOS[0].aluguel);
  const [meses, setMeses] = useState(CENARIOS[0].meses);
  const [locacoes, setLocacoes] = useState(CENARIOS[0].locacoes);
  const [cenarioAtivo, setCenarioAtivo] = useState<string | null>(CENARIOS[0].nome);

  const calc = useMemo(() => {
    const aluguelPorLocacao = aluguel * meses;
    const aluguelAno = aluguelPorLocacao * locacoes;
    const comissaoVN = aluguel * COMISSAO * locacoes;
    const propVN = aluguelAno - comissaoVN - SUB_ANUAL;
    const propAirbnb = aluguelAno * (1 - AIRBNB_IMPACTO);
    const platComissao = comissaoVN + SUB_ANUAL;
    const platAssinatura = SUB_ANUAL;
    return { aluguelPorLocacao, aluguelAno, comissaoVN, propVN, propAirbnb, platComissao, platAssinatura };
  }, [aluguel, meses, locacoes]);

  function aplicarCenario(c: Cenario) {
    setAluguel(c.aluguel);
    setMeses(c.meses);
    setLocacoes(c.locacoes);
    setCenarioAtivo(c.nome);
  }

  const diffOwner = calc.propVN - calc.propAirbnb;
  const vnGanha = diffOwner >= 0;

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
            Simule, por cenário, quanto o proprietário leva no ano e quanto a plataforma fatura.
            Ajuste os controles — tudo recalcula na hora. Números ilustrativos.
          </p>
        </header>

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
          <Slider
            label="Aluguel mensal"
            value={aluguel}
            min={1000}
            max={10000}
            step={100}
            display={brl(aluguel)}
            onChange={(v) => {
              setAluguel(v);
              setCenarioAtivo(null);
            }}
          />
          <Slider
            label="Prazo de cada locação"
            value={meses}
            min={1}
            max={6}
            step={1}
            display={`${meses} ${meses === 1 ? "mês" : "meses"}`}
            onChange={(v) => {
              setMeses(v);
              setCenarioAtivo(null);
            }}
          />
          <Slider
            label="Locações no ano"
            value={locacoes}
            min={1}
            max={6}
            step={1}
            display={`${locacoes}×`}
            onChange={(v) => {
              setLocacoes(v);
              setCenarioAtivo(null);
            }}
          />
        </div>

        {/* Resultado */}
        <div className={styles.results}>
          {/* Proprietário */}
          <div className={`${styles.result} ${styles.owner}`}>
            <h3>Proprietário · no ano</h3>
            <div className={styles.headline}>{brl(calc.propVN)}</div>
            <div className={styles.cap}>fica no bolso com o Viva Nomads</div>
            <div className={styles.compare}>
              <span>No Airbnb ficaria</span>
              <span className={styles.amt}>{brl(calc.propAirbnb)}</span>
            </div>
            <p className={styles.note}>
              {vnGanha ? (
                <>
                  Fica com <b>{brl(diffOwner)}</b> a mais no ano do que no Airbnb — com contrato,
                  verificação e garantia.
                </>
              ) : (
                <>
                  O Airbnb deixaria <b>{brl(-diffOwner)}</b> a mais, mas sem contrato, verificação nem
                  garantia.
                </>
              )}
            </p>
          </div>

          {/* Plataforma */}
          <div className={`${styles.result} ${styles.platform}`}>
            <h3>Viva Nomads · fatura no ano</h3>
            <div className={styles.headline}>{brl(calc.platComissao)}</div>
            <div className={styles.cap}>assinatura + comissão</div>
            <div className={styles.compare}>
              <span>Só assinatura</span>
              <span className={styles.amt}>{brl(calc.platAssinatura)}</span>
            </div>
            <p className={styles.note}>
              A comissão adiciona <b>{brl(calc.comissaoVN)}</b> por ano sobre a assinatura; no plano
              topo, cai perto de zero (modelo Furnished Finder).
            </p>
          </div>
        </div>

        {/* Detalhamento */}
        <div className={styles.card}>
          <h2>Como chegamos nos números</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <Row label="Aluguel por locação (aluguel × meses)" value={brl(calc.aluguelPorLocacao)} />
                <Row label="Locações no ano" value={`${locacoes}×`} />
                <Row label="Aluguel bruto no ano" value={brl(calc.aluguelAno)} />
                <Row
                  label={`Comissão Viva Nomads (10% do 1º mês × ${locacoes})`}
                  value={`− ${brl(calc.comissaoVN)}`}
                  muted
                />
                <Row label="Assinatura anual (Essencial)" value={`− ${brl(SUB_ANUAL)}`} muted />
                <Row label="Proprietário fica com (Viva Nomads)" value={brl(calc.propVN)} total />
                <Row label="Proprietário no Airbnb (−14%)" value={brl(calc.propAirbnb)} muted />
                <Row label="Plataforma fatura (assinatura + comissão)" value={brl(calc.platComissao)} muted />
                <Row label="Plataforma (só assinatura)" value={brl(calc.platAssinatura)} muted />
              </tbody>
            </table>
          </div>
        </div>

        {/* Premissas */}
        <div className={`${styles.card} ${styles.premissas}`}>
          <h2>Premissas</h2>
          <ul>
            <li>Comissão sobre o <strong>1º mês</strong> de cada locação (plano Essencial: 10%).</li>
            <li>Assinatura do proprietário: <strong>R$ 588/ano</strong> (Essencial, R$ 49/mês).</li>
            <li>Impacto do Airbnb sobre o aluguel: <strong>~14%</strong> (referência de mercado).</li>
            <li>“Só assinatura” = comissão zero (plano topo / modelo Furnished Finder).</li>
          </ul>
          <span className={styles.ill}>Valores ilustrativos — não são projeção contábil.</span>
        </div>

        <footer className={styles.footer}>
          Viva Nomads · simulador de modelo de negócio. Números ilustrativos, não constituem promessa
          de resultado.
        </footer>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.slider}>
      <div className={styles.top}>
        <span className={styles.lbl}>{label}</span>
        <span className={styles.val}>{display}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value) || min)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  total,
}: {
  label: string;
  value: string;
  muted?: boolean;
  total?: boolean;
}) {
  return (
    <tr className={total ? styles.total : muted ? styles.muted : undefined}>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
}
