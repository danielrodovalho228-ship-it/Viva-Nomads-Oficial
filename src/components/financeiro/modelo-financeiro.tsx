"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import styles from "./financeiro.module.css";
import { PLANOS } from "@/config/planos";
import {
  ALUGUEL_MEDIO,
  ASSINATURA,
  CENARIOS,
  CUSTO_FIXO_FAIXA,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  DOLAR,
  FUNDADORES,
  IMPOSTO_SOBRE_RECEITA,
  INVESTIMENTO_INICIAL,
  MES_PRIMEIRO_CONTRATO,
  MIX_PLANOS,
  OPERADOR_OPCOES,
  RECEITAS_FUTURAS,
  REFERENCIA,
  SEGURO_INCENDIO,
  marketingDoMes,
  type CenarioId,
  type Item,
} from "@/config/premissas-financeiras";
import { CUSTO_FIXO_PADRAO, comissaoMediaPorContrato, porContrato, projetar, type Projecao } from "@/lib/financeiro/projecao";

/**
 * Modelo financeiro da empresa — /simulacao e /roi (documentos internos dos
 * sócios). Mesma conta (lib/financeiro/projecao) e mesmas premissas
 * (config/premissas-financeiras); muda só o foco do topo.
 */

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mil = (n: number) => `${n < 0 ? "−" : ""}R$ ${(Math.abs(n) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
const mes = (m: number | null) => (m === null ? "não em 36 meses" : `mês ${m}`);
const ORDEM: CenarioId[] = ["pessimista", "base", "otimista"];

const TEXTO = {
  simulacao: {
    h1: "Simulação do negócio — documento interno dos sócios",
    sub: "Quanto entra e quanto custa cada contrato, e o que isso dá em 36 meses. Escolha o cenário e se há operador local pago.",
  },
  roi: {
    h1: "Quando o negócio se paga?",
    sub: "Caixa da empresa em 36 meses: dinheiro necessário (pior caixa), primeiro mês positivo e payback. Mesmas premissas da Simulação.",
  },
} as const;

export function ModeloFinanceiro({ pagina }: { pagina: "simulacao" | "roi" }) {
  const [cenario, setCenario] = useState<CenarioId>("base");
  const [operador, setOperador] = useState<number>(0);
  const [custoFixo, setCustoFixo] = useState<number>(CUSTO_FIXO_PADRAO);

  const op = useMemo(() => ({ operador, custoFixo }), [operador, custoFixo]);
  const proj = useMemo(() => projetar(cenario, op), [cenario, op]);
  const todos = useMemo(() => Object.fromEntries(ORDEM.map((id) => [id, projetar(id, op)])) as Record<CenarioId, Projecao>, [op]);
  const unit = useMemo(() => porContrato(op), [op]);
  const t = TEXTO[pagina];

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`${styles.topbar} ${styles.noprint}`}>
          <Link className={styles.brand} href="/">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </Link>
          <button type="button" className={styles.btn} onClick={() => window.print()}>
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        <h1 className={styles.h1}>{t.h1}</h1>
        <p className={styles.sub}>{t.sub}</p>
        <p className={styles.warn} data-testid="aviso-premissas">
          <strong>Estimativas de {REFERENCIA} para decidir, não parecer contábil.</strong> Preços das ferramentas com fonte abaixo; dólar a{" "}
          {brl2(DOLAR)}. Identidade e antifraude da CAF ainda precisam de orçamento formal.
        </p>

        {/* Controles */}
        <div className={styles.card}>
          <h2>Cenário</h2>
          <div className={styles.toggles} role="group" aria-label="Cenário">
            {ORDEM.map((id) => (
              <button key={id} type="button" className={styles.pill} aria-pressed={cenario === id} onClick={() => setCenario(id)}>
                {CENARIOS[id].nome}
              </button>
            ))}
          </div>
          <div className={styles.toggles} role="group" aria-label="Operador local">
            <span className={styles.lbl}>Operador local por contrato:</span>
            {OPERADOR_OPCOES.map((v) => (
              <button key={v} type="button" className={styles.pill} aria-pressed={operador === v} onClick={() => setOperador(v)}>
                {v === 0 ? "Sem operador pago" : `${brl(v)} por contrato`}
              </button>
            ))}
          </div>
          <div className={styles.slider} style={{ marginTop: 14 }}>
            <div className={styles.top}>
              <label className={styles.lbl} htmlFor="custo-fixo">
                Custo fixo por mês ({CUSTO_FIXO_FAIXA.texto})
              </label>
              <span className={styles.val}>{brl(custoFixo)}</span>
            </div>
            <input id="custo-fixo" type="range" min={CUSTO_FIXO_FAIXA.min} max={CUSTO_FIXO_FAIXA.max} step={1} value={custoFixo} onChange={(e) => setCustoFixo(Number(e.target.value))} />
          </div>
        </div>

        {/* Por contrato */}
        <div className={styles.kpibar} data-testid="kpis-contrato">
          <Kpi k="Receita por contrato" v={brl2(unit.receita)} hint={`comissão média ${brl2(comissaoMediaPorContrato())} + seguro ${brl(SEGURO_INCENDIO.porContrato)}`} />
          <Kpi k="Custo variável por contrato" v={brl2(unit.custoVariavel)} hint={`ferramentas + ${Math.round(IMPOSTO_SOBRE_RECEITA * 100)}% de imposto${operador ? " + operador" : ""}`} />
          <Kpi k="Margem por contrato" v={brl2(unit.margem)} hint="receita − custo variável" />
          <Kpi k="Contratos/mês para empatar" v={`${Math.ceil(unit.empate[0])} a ${Math.ceil(unit.empate[1])}`} hint="fixo + marketing, sem contar assinaturas" />
        </div>

        {/* Resultado do cenário */}
        <div className={styles.card}>
          <h2>Resultado — cenário {CENARIOS[cenario].nome}</h2>
          <div className={styles.projSummary}>
            <Mini k="Pior caixa (investimento necessário)" v={mil(proj.piorCaixa)} cls={styles.neg} />
            <Mini k="1º resultado mensal positivo" v={mes(proj.mesPrimeiroPositivo)} />
            <Mini k="Payback (caixa ≥ 0)" v={mes(proj.mesPayback)} />
            <Mini k="Caixa em 36 meses" v={mil(proj.caixaFinal)} cls={proj.caixaFinal >= 0 ? styles.pos : styles.neg} />
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th>Contratos</th>
                  <th>Receita</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {proj.anos.map((a) => (
                  <tr key={a.ano}>
                    <td>Ano {a.ano}</td>
                    <td>{Math.round(a.contratos)}</td>
                    <td>{mil(a.receita)}</td>
                    <td className={a.resultado < 0 ? styles.neg : styles.pos}>{mil(a.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.chartTitle}>Caixa acumulado (mês 0 = investimento de {brl(INVESTIMENTO_INICIAL)})</p>
          <GraficoCaixa proj={proj} />
        </div>

        {/* Os 3 cenários lado a lado */}
        <div className={styles.card}>
          <h2>Os três cenários {operador ? `(com operador de ${brl(operador)})` : "(sem operador pago)"}</h2>
          <div className={styles.tblWrap}>
            <table className={styles.tbl} data-testid="tabela-cenarios">
              <thead>
                <tr>
                  <th />
                  {ORDEM.map((id) => (
                    <th key={id}>{CENARIOS[id].nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Linha rotulo="Contratos ano 1 / 2 / 3" vals={ORDEM.map((id) => todos[id].anos.map((a) => Math.round(a.contratos)).join(" / "))} />
                <Linha rotulo="Receita ano 3" vals={ORDEM.map((id) => mil(todos[id].anos[2].receita))} />
                <Linha rotulo="Resultado ano 3" vals={ORDEM.map((id) => mil(todos[id].anos[2].resultado))} />
                <Linha rotulo="Pior caixa" vals={ORDEM.map((id) => mil(todos[id].piorCaixa))} />
                <Linha rotulo="1º mês positivo" vals={ORDEM.map((id) => mes(todos[id].mesPrimeiroPositivo))} />
                <Linha rotulo="Payback" vals={ORDEM.map((id) => mes(todos[id].mesPayback))} />
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.cols}>
          <Quadro
            titulo="Custos fixos (por mês)"
            itens={CUSTOS_FIXOS}
            rodape={[
              ["Total usado na conta", brl(custoFixo)],
              ["Faixa", CUSTO_FIXO_FAIXA.texto],
              ["Marketing", `R$ 0 nos meses 1–3 · ${brl(marketingDoMes(4))} no ano 1 · ${brl(marketingDoMes(13))} depois`],
              ["Investimento único", `${brl(INVESTIMENTO_INICIAL)} (jurídico, CNPJ, marca, Google Play, lançamento)`],
            ]}
          />
          <Quadro
            titulo="Custos por contrato"
            itens={CUSTOS_POR_CONTRATO}
            rodape={[
              ["Imposto (Simples, faixa inicial — confirmar com o contador)", `${Math.round(IMPOSTO_SOBRE_RECEITA * 100)}% da receita`],
              ["Operador local (opcional)", operador ? brl(operador) : "R$ 0 (sócios fazem)"],
            ]}
          />
        </div>

        <div className={styles.card}>
          <h2>Receitas futuras (desligadas — não existem hoje)</h2>
          <ul className={styles.legend}>
            {RECEITAS_FUTURAS.map((r) => (
              <li key={r.rotulo} className={styles.off}>
                {r.rotulo} — {r.valor ? `${brl(r.valor)} ${r.unidade.replace("R$/", "por ")}` : r.unidade}
                {r.obs ? ` · ${r.obs}` : ""}
              </li>
            ))}
          </ul>
        </div>

        <details className={`${styles.card} ${styles.method}`} open>
          <summary>Como calculamos</summary>
          <div className={styles.body}>
            <ul>
              <li>
                Aluguel médio de {brl(ALUGUEL_MEDIO)}. Comissão pelo mix de planos dos donos:{" "}
                {PLANOS.filter((p) => MIX_PLANOS[p.id] > 0)
                  .map((p) => `${Math.round(MIX_PLANOS[p.id] * 100)}% ${p.nome} (${Math.round(p.comissao * 100)}%)`)
                  .join(", ")}{" "}
                — de config/planos.ts.
              </li>
              <li>
                <strong>Fundadores:</strong> os {FUNDADORES.quantidade} primeiros donos ficam {FUNDADORES.meses} meses no Profissional sem assinatura (comissão de{" "}
                {Math.round(FUNDADORES.comissao * 100)}%). A parte dos contratos que vem deles = Fundadores nesse período ÷ todos os donos. Depois dos {FUNDADORES.meses} meses, assinam na mesma
                proporção dos outros.
              </li>
              <li>
                <strong>Assinaturas:</strong> donos novos entram desde o mês 1; a fração do cenário assina (média {brl(ASSINATURA.mediaPagantes)}/mês), com churn de{" "}
                {Math.round(ASSINATURA.churnMensal * 100)}% ao mês.
              </li>
              <li>Contratos começam no mês {MES_PRIMEIRO_CONTRATO} e crescem em linha reta até o teto do cenário. Seguro incêndio ({brl(SEGURO_INCENDIO.porContrato)} por contrato) a partir do mês {SEGURO_INCENDIO.aPartirDoMes}.</li>
              <li>
                <strong>Custo fixo:</strong> {brl(CUSTO_FIXO_PADRAO)}/mês por padrão ({CUSTO_FIXO_FAIXA.texto}).
              </li>
              <li>
                Tudo é editável em <code>src/config/premissas-financeiras.ts</code> (referência {REFERENCIA}).
              </li>
            </ul>
          </div>
        </details>

        <p className={styles.footer}>Documento interno dos sócios · estimativas para decidir, não parecer contábil.</p>
      </div>
    </div>
  );
}

function Kpi({ k, v, hint }: { k: string; v: string; hint: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.k}>{k}</div>
      <div className={styles.v} style={{ color: "var(--forest)" }}>
        {v}
      </div>
      <div className={styles.hint}>{hint}</div>
    </div>
  );
}

function Mini({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className={styles.miniKpi}>
      <div className={styles.k}>{k}</div>
      <div className={`${styles.v} ${cls ?? ""}`}>{v}</div>
    </div>
  );
}

function Linha({ rotulo, vals }: { rotulo: string; vals: string[] }) {
  return (
    <tr>
      <td>{rotulo}</td>
      {vals.map((v, i) => (
        <td key={i}>{v}</td>
      ))}
    </tr>
  );
}

function Quadro({ titulo, itens, rodape }: { titulo: string; itens: Item[]; rodape: [string, string][] }) {
  return (
    <div className={styles.card}>
      <h2>{titulo}</h2>
      <p className={styles.cardHelp}>Valores de {REFERENCIA}, com fonte.</p>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <tbody>
            {itens.map((i) => (
              <tr key={i.rotulo}>
                <td>
                  {i.rotulo}
                  {(i.fonte || i.obs) && (
                    <div className={styles.fonte}>
                      {i.obs}
                      {i.obs && i.fonte ? " · " : ""}
                      {i.fonte && (
                        <a href={i.fonte} target="_blank" rel="noopener noreferrer">
                          fonte
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td>{brl2(i.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {rodape.map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Caixa acumulado (SVG simples, linha do zero destacada). */
function GraficoCaixa({ proj }: { proj: Projecao }) {
  const W = 640;
  const H = 200;
  const P = 28;
  const pontos = [{ m: 0, caixa: -INVESTIMENTO_INICIAL }, ...proj.meses.map((x) => ({ m: x.m, caixa: x.caixa }))];
  const min = Math.min(0, ...pontos.map((p) => p.caixa));
  const max = Math.max(0, ...pontos.map((p) => p.caixa));
  const x = (m: number) => P + (m / 36) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p.caixa).toFixed(1)}`).join(" ");
  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Caixa acumulado: pior ${mil(proj.piorCaixa)} no mês ${proj.mesPiorCaixa}, ${mil(proj.caixaFinal)} no mês 36`}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="#c9d6ce" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke="#0f3d2e" strokeWidth={2.5} />
        <circle cx={x(proj.mesPiorCaixa)} cy={y(proj.piorCaixa)} r={4} fill="#c0392b" />
        <text x={x(proj.mesPiorCaixa)} y={y(proj.piorCaixa) + 16} fontSize={11} textAnchor="middle" fill="#c0392b">
          {mil(proj.piorCaixa)}
        </text>
        {[0, 12, 24, 36].map((m) => (
          <text key={m} x={x(m)} y={H - 8} fontSize={11} textAnchor="middle" fill="#6b7280">
            {m === 0 ? "mês 0" : `mês ${m}`}
          </text>
        ))}
      </svg>
    </div>
  );
}
