/*
  Gastos de marketing (0067) — regras PURAS da tela do admin: canais, validação
  do lançamento e totais por mês. Sem imports (testável com node --test).
*/

export const CANAIS_MARKETING = [
  { key: "instagram", label: "Instagram" },
  { key: "google", label: "Google" },
  { key: "indicacao", label: "Indicação" },
  { key: "outro", label: "Outro" },
] as const;
export type CanalMarketing = (typeof CANAIS_MARKETING)[number]["key"];

export interface GastoMarketing {
  id: string;
  mes: string; // AAAA-MM-01
  canal: CanalMarketing;
  valor: number;
  observacao: string | null;
}

export interface GastoEntrada {
  mes: string; // AAAA-MM (campo <input type="month">)
  canal: string;
  valor: string | number;
  observacao?: string;
}

export function canalLabel(k: string): string {
  return CANAIS_MARKETING.find((c) => c.key === k)?.label ?? k;
}

/** Valor em reais digitado ("1.234,56", "350.5", 350) → número, ou NaN. */
export function valorReais(v: string | number): number {
  if (typeof v === "number") return v;
  const s = v.trim().replace(/^R\$\s*/i, "");
  if (!s) return NaN;
  // Com vírgula: padrão brasileiro (ponto = milhar).
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Valida o lançamento. Ok → linha pronta para gravar; senão, a mensagem. */
export function validarGasto(
  e: GastoEntrada
): { ok: true; linha: { mes: string; canal: CanalMarketing; valor: number; observacao: string | null } } | { ok: false; erro: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.mes ?? "")) return { ok: false, erro: "Escolha o mês." };
  const ano = Number(e.mes.slice(0, 4));
  if (ano < 2024 || ano > 2100) return { ok: false, erro: "Mês fora do período aceito." };
  const canal = CANAIS_MARKETING.find((c) => c.key === e.canal)?.key;
  if (!canal) return { ok: false, erro: "Escolha o canal." };
  const valor = valorReais(e.valor);
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, erro: "Informe um valor válido (R$ 0 ou mais)." };
  if (valor > 10_000_000) return { ok: false, erro: "Valor alto demais — confira." };
  const obs = (e.observacao ?? "").trim().slice(0, 500);
  return {
    ok: true,
    linha: { mes: `${e.mes}-01`, canal, valor: Math.round(valor * 100) / 100, observacao: obs || null },
  };
}

/** Total por mês (mais recente primeiro), em centavos para não somar errado. */
export function totaisPorMes(gastos: GastoMarketing[]): { mes: string; total: number }[] {
  const m = new Map<string, number>();
  for (const g of gastos) m.set(g.mes, (m.get(g.mes) ?? 0) + Math.round(g.valor * 100));
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([mes, c]) => ({ mes, total: c / 100 }));
}

/** CSV (separador ;, padrão do Excel em pt-BR). */
export function gastosCsv(gastos: GastoMarketing[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const linhas = gastos.map((g) =>
    [g.mes.slice(0, 7), canalLabel(g.canal), g.valor.toFixed(2).replace(".", ","), esc(g.observacao ?? "")].join(";")
  );
  return ["mes;canal;valor;observacao", ...linhas].join("\n");
}
