"use client";

import { useState } from "react";
import styles from "./simulacao.module.css";
import { formatBRL, formatInt } from "@/lib/simulacao/model";
import type { ResultadoProjecao, MesProjecao } from "@/lib/simulacao/model";

const W = 600;
const H = 200;
const PAD_T = 12;
const PAD_B = 24;

type Hover = { i: number; leftPct: number; topPct: number } | null;

/** Rótulos do eixo X: 1º, meio e último mês. */
function labelIdx(n: number): number[] {
  if (n <= 1) return [0];
  return Array.from(new Set([0, Math.floor(n / 2), n - 1]));
}

/** Gráfico de barras: receita e lucro por mês, com tooltip ao passar o mouse. */
function BarsChart({ meses }: { meses: MesProjecao[] }) {
  const [hover, setHover] = useState<Hover>(null);
  const padX = 10;
  const n = meses.length;
  const max = Math.max(1, ...meses.map((x) => x.receita));
  const gw = (W - 2 * padX) / n;
  const bw = Math.max(1, Math.min(13, gw / 2 - 1));
  const base = H - PAD_B;
  const plotH = H - PAD_T - PAD_B;

  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receita e lucro por mês">
        {meses.map((x, i) => {
          const gx = padX + i * gw + (gw / 2 - bw - 1);
          const hR = (x.receita / max) * plotH;
          const hL = (Math.max(0, x.lucro) / max) * plotH;
          return (
            <g key={i}>
              <rect x={gx} y={base - hR} width={bw} height={hR} fill="#5a8a6b" rx="1" />
              <rect x={gx + bw + 1} y={base - hL} width={bw} height={hL} fill="#c8a24b" rx="1" />
            </g>
          );
        })}
        <line x1={padX} y1={base} x2={W - padX} y2={base} stroke="#e3e9e5" />
        {labelIdx(n).map((idx) => (
          <text
            key={idx}
            x={padX + idx * gw + gw / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            m{meses[idx].m}
          </text>
        ))}
        {/* colunas invisíveis de hover */}
        {meses.map((x, i) => {
          const cx = padX + i * gw + gw / 2;
          const hR = (x.receita / max) * plotH;
          return (
            <rect
              key={`h${i}`}
              x={padX + i * gw}
              y={PAD_T}
              width={gw}
              height={plotH}
              fill="transparent"
              onMouseEnter={() =>
                setHover({ i, leftPct: (cx / W) * 100, topPct: ((base - hR) / H) * 100 })
              }
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div className={styles.tooltip} style={{ left: `${hover.leftPct}%`, top: `${hover.topPct}%` }}>
          <div>Mês {meses[hover.i].m}</div>
          <div className={styles.r}>Receita: <b>{formatBRL(meses[hover.i].receita)}</b></div>
          <div className={styles.l}>Lucro: <b>{formatBRL(meses[hover.i].lucro)}</b></div>
        </div>
      )}
    </div>
  );
}

/** Gráfico de área/linha: receita e lucro acumulados, com tooltip. */
function LineChart({ meses }: { meses: MesProjecao[] }) {
  const [hover, setHover] = useState<Hover>(null);
  const padX = 40;
  const n = meses.length;
  const maxC = Math.max(1, ...meses.map((x) => x.receitaAcumulada));
  const base = H - PAD_B;
  const plotH = H - PAD_T - PAD_B;
  const innerW = W - 2 * padX;

  const px = (i: number) => padX + (n === 1 ? 0 : (i / (n - 1)) * innerW);
  const py = (v: number) => base - (Math.max(0, v) / maxC) * plotH;

  const recPts = meses.map((x, i) => `${px(i).toFixed(1)},${py(x.receitaAcumulada).toFixed(1)}`).join(" ");
  const luPts = meses.map((x, i) => `${px(i).toFixed(1)},${py(x.lucroAcumulado).toFixed(1)}`).join(" ");
  const areaPts = `${padX},${base} ${recPts} ${(W - padX).toFixed(1)},${base}`;

  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receita e lucro acumulados">
        <line x1={padX} y1={base} x2={W - padX} y2={base} stroke="#e3e9e5" />
        <polygon points={areaPts} fill="#0f3d2e" fillOpacity="0.08" />
        <polyline fill="none" stroke="#0f3d2e" strokeWidth="2.5" points={recPts} />
        <polyline fill="none" stroke="#c8a24b" strokeWidth="2" points={luPts} />
        {hover && (
          <>
            <circle cx={px(hover.i)} cy={py(meses[hover.i].receitaAcumulada)} r="3.5" fill="#0f3d2e" />
            <circle cx={px(hover.i)} cy={py(meses[hover.i].lucroAcumulado)} r="3.5" fill="#c8a24b" />
          </>
        )}
        {labelIdx(n).map((idx) => (
          <text key={idx} x={px(idx)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
            m{meses[idx].m}
          </text>
        ))}
        {meses.map((x, i) => {
          const half = n === 1 ? innerW / 2 : innerW / (n - 1) / 2;
          return (
            <rect
              key={`h${i}`}
              x={px(i) - half}
              y={PAD_T}
              width={half * 2}
              height={plotH}
              fill="transparent"
              onMouseEnter={() =>
                setHover({
                  i,
                  leftPct: (px(i) / W) * 100,
                  topPct: (py(x.receitaAcumulada) / H) * 100,
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div className={styles.tooltip} style={{ left: `${hover.leftPct}%`, top: `${hover.topPct}%` }}>
          <div>Mês {meses[hover.i].m}</div>
          <div className={styles.r}>Receita acum.: <b>{formatBRL(meses[hover.i].receitaAcumulada)}</b></div>
          <div className={styles.l}>Lucro acum.: <b>{formatBRL(meses[hover.i].lucroAcumulado)}</b></div>
        </div>
      )}
    </div>
  );
}

/** Bloco de projeção no tempo: 4 números-resumo + 2 gráficos interativos. */
export function ProjecaoCharts({ proj }: { proj: ResultadoProjecao }) {
  const lucroNeg = proj.lucroAcumulado < 0;
  return (
    <div className={styles.card}>
      <h2>Projeção no tempo</h2>
      <p className={styles.cardHelp}>
        Crescimento composto dos fechamentos, base de planos com churn e conversão — mês a mês.
      </p>
      <div className={styles.projSummary}>
        <div className={styles.miniKpi}>
          <div className={styles.k}>Receita acumulada</div>
          <div className={styles.v} style={{ color: "var(--forest)" }}>{formatBRL(proj.receitaAcumulada)}</div>
        </div>
        <div className={styles.miniKpi}>
          <div className={styles.k}>Lucro acumulado</div>
          <div className={styles.v} style={{ color: lucroNeg ? "var(--danger)" : "var(--forest)" }}>
            {formatBRL(proj.lucroAcumulado)}
          </div>
        </div>
        <div className={styles.miniKpi}>
          <div className={styles.k}>Base de planos no fim</div>
          <div className={styles.v} style={{ color: "var(--sage)" }}>{formatInt(proj.baseFinal)}</div>
        </div>
        <div className={styles.miniKpi}>
          <div className={styles.k}>Receita no último mês</div>
          <div className={styles.v} style={{ color: "var(--gold)" }}>{formatBRL(proj.receitaUltimoMes)}</div>
        </div>
      </div>

      <div className={styles.chartTitle}>Receita e lucro por mês</div>
      <BarsChart meses={proj.meses} />
      <div className={styles.chartLegend}>
        <span><span className={styles.sw} style={{ background: "var(--sage)" }} />Receita</span>
        <span><span className={styles.sw} style={{ background: "var(--gold)" }} />Lucro</span>
      </div>

      <div className={styles.chartTitle}>Receita e lucro acumulados</div>
      <LineChart meses={proj.meses} />
      <div className={styles.chartLegend}>
        <span><span className={styles.sw} style={{ background: "var(--forest)" }} />Receita acumulada</span>
        <span><span className={styles.sw} style={{ background: "var(--gold)" }} />Lucro acumulado</span>
      </div>
    </div>
  );
}
