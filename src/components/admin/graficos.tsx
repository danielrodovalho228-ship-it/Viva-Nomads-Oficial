"use client";

import { Bar, BarChart, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Gráficos do /admin (Recharts). Uma série só, na cor da marca (forest
 * #1c6b3a — passa contraste e croma contra o branco). Texto sempre em tinta
 * neutra, nunca na cor da série. Todo gráfico tem tooltip no hover.
 */
const COR = "#1c6b3a";
const TINTA = "#0f1722";
const MUDO = "#5b6573";

function diaCurto(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Sparkline: tendência diária do indicador no período, sem eixos. */
export function Sparkline({ pontos, rotulo }: { pontos: { dia: string; v: number }[]; rotulo: string }) {
  if (pontos.length < 2) return null;
  return (
    <div className="h-10 w-full" role="img" aria-label={`Tendência diária de ${rotulo}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={COR} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Tooltip
            cursor={{ stroke: "#e2e7ee", strokeWidth: 1 }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e7ee", color: TINTA, padding: "4px 8px" }}
            labelFormatter={(_, p) => (p?.[0]?.payload?.dia ? diaCurto(p[0].payload.dia as string) : "")}
            formatter={(v) => [Number(v).toLocaleString("pt-BR"), rotulo]}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Funil: barras horizontais com valor e % sobre a etapa anterior. */
export function Funil({ etapas }: { etapas: { rotulo: string; valor: number | null; texto: string }[] }) {
  const dados = etapas.map((e) => ({ ...e, v: e.valor ?? 0 }));
  const altura = Math.max(200, dados.length * 44);
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, (max: number) => Math.max(1, max)]} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: TINTA, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#eef6ef" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e7ee", color: TINTA }}
            formatter={(_, __, p) => [(p?.payload as { texto: string }).texto, (p?.payload as { rotulo: string }).rotulo]}
            labelFormatter={() => ""}
          />
          <Bar dataKey="v" radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
            {dados.map((d) => (
              <Cell key={d.rotulo} fill={d.valor === null ? "#e2e7ee" : COR} />
            ))}
            <LabelList dataKey="texto" position="right" style={{ fill: MUDO, fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras por mês (uma série). Mês sem dado (null) fica sem barra, com "—" no tooltip. */
export function BarrasMensais({
  dados,
  rotulo,
  formatar,
}: {
  dados: { mes: string; rotuloMes: string; v: number | null }[];
  rotulo: string;
  formatar: (v: number | null) => string;
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`${rotulo} por mês`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={6}>
          <XAxis dataKey="rotuloMes" tickLine={false} axisLine={{ stroke: "#e2e7ee" }} tick={{ fill: MUDO, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
          <Tooltip
            cursor={{ fill: "#eef6ef" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e7ee", color: TINTA }}
            formatter={(_, __, p) => [formatar((p?.payload as { v: number | null }).v), rotulo]}
          />
          <Bar dataKey="v" fill={COR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Linha por mês (uma série); null quebra a linha (antes do histórico). */
export function LinhaMensal({
  dados,
  rotulo,
  formatar,
}: {
  dados: { mes: string; rotuloMes: string; v: number | null }[];
  rotulo: string;
  formatar: (v: number | null) => string;
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`${rotulo} por mês`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="rotuloMes" tickLine={false} axisLine={{ stroke: "#e2e7ee" }} tick={{ fill: MUDO, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
          <Tooltip
            cursor={{ stroke: "#e2e7ee", strokeWidth: 1 }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e7ee", color: TINTA }}
            formatter={(_, __, p) => [formatar((p?.payload as { v: number | null }).v), rotulo]}
          />
          <Line type="monotone" dataKey="v" stroke={COR} strokeWidth={2} dot={{ r: 4, fill: COR, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
