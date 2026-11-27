/*
  Gastos de marketing (0067) — regras PURAS da tela do admin: canais, validação
  do lançamento e totais por mês. Só imports puros (testável com node --test).
*/
import { lerReais } from "./reais.ts";

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

/** Valor em reais digitado ("1.234,56", "3.300", 350) → número, ou NaN. Lê pela fonte única (lerReais). */
export function valorReais(v: string | number): number {
  if (typeof v === "number") return v;
  const r = lerReais(v);
  return r.ok && r.valor != null ? r.valor : NaN;
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

/* E476 (ii): o mês em português na tela do admin, sem depender do idioma do navegador (o <input type="month"> nativo
   escrevia "November 2026"). O valor gravado não muda (AAAA-MM). */
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" → "novembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES_PT[m - 1] ?? "?"} de ${a}`;
}

/** Meses para escolher: do mês atual (AAAA-MM) até janeiro de 2024 (o início do período aceito), do mais recente. */
export function opcoesDeMes(atual: string): { valor: string; rotulo: string }[] {
  let [a, m] = atual.split("-").map(Number);
  const out: { valor: string; rotulo: string }[] = [];
  while (a > 2024 || (a === 2024 && m >= 1)) {
    const valor = `${a}-${String(m).padStart(2, "0")}`;
    out.push({ valor, rotulo: rotuloDoMes(valor) });
    m -= 1;
    if (m === 0) {
      m = 12;
      a -= 1;
    }
  }
  return out;
}
