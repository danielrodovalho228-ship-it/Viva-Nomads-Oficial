"use client";

import { useMemo } from "react";
import { MERCADO, reaisInteiros, type PlanoId } from "@/config/planos";
import { serieCustoPorImovel } from "@/lib/comparativo-precos";

/**
 * "Custo por imóvel no ano" (1 a 20 imóveis) — mesmo gráfico em /precos e
 * /modelodenegocio. Uma linha por plano (só onde o plano serve), Airbnb
 * tracejado, marcador do empate Essencial × Profissional e o ponto da pessoa.
 * SVG puro; números só de lib/comparativo-precos + config/planos.
 */

const COR: Record<PlanoId, string> = { free: "#8a9790", essential: "#c8a24b", pro: "#0f3d2e", gestor: "#3f7cac" };
const AIRBNB = "#d9534f";

const W = 360;
const H = 230;
const PAD = { l: 46, r: 12, t: 14, b: 30 };

export function GraficoCustoPorImovel({
  aluguel,
  meses,
  locacoes,
  imoveis,
  plano,
}: {
  aluguel: number;
  meses: number;
  locacoes: number;
  /** Ponto atual da pessoa (só aparece até 20 imóveis). */
  imoveis?: number;
  plano?: PlanoId;
}) {
  const s = useMemo(() => serieCustoPorImovel(aluguel, meses, locacoes), [aluguel, meses, locacoes]);
  const valores = [s.airbnb, ...s.planos.flatMap((p) => p.pontos.map((x) => x.porImovel))];
  // Eixo com números redondos: até 4 faixas de 500, 1.000, 2.000…
  const topo = Math.max(100, ...valores) * 1.05;
  const passo = [250, 500, 1000, 1500, 2000, 2500, 5000, 10000].find((p) => topo / p <= 4) ?? 20000;
  const yMax = Math.ceil(topo / passo) * passo;
  const x = (n: number) => PAD.l + ((n - 1) / (s.ate - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const ticks = Array.from({ length: yMax / passo + 1 }, (_, i) => i * passo);
  const atual = imoveis && plano ? s.planos.find((p) => p.id === plano)?.pontos.find((p) => p.imoveis === imoveis) : undefined;

  return (
    <figure className="m-0" data-testid="grafico-custo-por-imovel">
      <figcaption className="text-sm font-semibold text-ink">Custo por imóvel no ano</figcaption>
      <p className="text-xs text-muted">
        Aluguel de {reaisInteiros(aluguel)}, {locacoes} {locacoes === 1 ? "locação" : "locações"} de {meses} {meses === 1 ? "mês" : "meses"} por imóvel no ano. Cada plano aparece só na faixa de imóveis que ele atende.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Custo por imóvel no ano, de 1 a 20 imóveis, por plano e no Airbnb">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e3e9e5" />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#6b7280">
              {t >= 1000 ? `${(t / 1000).toLocaleString("pt-BR")} mil` : t}
            </text>
          </g>
        ))}
        {[1, 5, 10, 15, 20].map((n) => (
          <text key={n} x={x(n)} y={H - PAD.b + 13} textAnchor="middle" fontSize="9" fill="#6b7280">
            {n}
          </text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 3} textAnchor="middle" fontSize="9" fill="#6b7280">
          imóveis
        </text>

        <line x1={x(1)} x2={x(s.ate)} y1={y(s.airbnb)} y2={y(s.airbnb)} stroke={AIRBNB} strokeWidth="1.6" strokeDasharray="5 4" />

        {s.empateEssencialPro !== null && (
          <g data-testid="marcador-empate">
            <line x1={x(s.empateEssencialPro)} x2={x(s.empateEssencialPro)} y1={PAD.t} y2={H - PAD.b} stroke="#6b7280" strokeDasharray="2 3" />
            <text x={x(s.empateEssencialPro) + 3} y={PAD.t + 26} fontSize="8.5" fill="#374151">
              Essencial = Profissional
            </text>
          </g>
        )}

        {s.planos.map((p) => (
          <g key={p.id}>
            {p.pontos.length > 1 && (
              <polyline fill="none" stroke={COR[p.id]} strokeWidth="2" points={p.pontos.map((q) => `${x(q.imoveis)},${y(q.porImovel)}`).join(" ")} />
            )}
            {p.pontos.length === 1 && <circle cx={x(p.pontos[0].imoveis)} cy={y(p.pontos[0].porImovel)} r="3.5" fill={COR[p.id]} />}
          </g>
        ))}

        {atual && (
          <g data-testid="marcador-voce">
            <circle cx={x(atual.imoveis)} cy={y(atual.porImovel)} r="5.5" fill="#fff" stroke={COR[plano!]} strokeWidth="2.5" />
            <text x={x(atual.imoveis)} y={y(atual.porImovel) - 9} textAnchor={atual.imoveis > 16 ? "end" : "middle"} fontSize="9" fontWeight="700" fill="#0f3d2e">
              Você: {reaisInteiros(atual.porImovel)}
            </text>
          </g>
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {s.planos.map((p) => (
          <li key={p.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: COR[p.id] }} /> {p.nome}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: AIRBNB }} /> Airbnb ({reaisInteiros(s.airbnb)} por imóvel: {Math.round(MERCADO.airbnbTaxa * 100)}% de todo o período)
        </li>
      </ul>
    </figure>
  );
}
