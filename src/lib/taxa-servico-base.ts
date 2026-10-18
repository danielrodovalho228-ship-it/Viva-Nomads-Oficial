/*
  Prompt 23 (item 4): o contrato mostra a BASE REAL da taxa de serviço que foi gravada no aceite. Contratos antigos
  (antes da regra do valor total) têm a taxa sobre 1 mês; os novos, sobre o valor total (valor mensal × meses).
  Nada de afirmar regra de renovação aqui (aguarda a Dra. Beatriz). Vocabulário: "taxa de serviço".
*/

export type BaseTaxa = "valor_total" | "um_mes" | "outra";

const centavos = (n: number) => Math.round(n * 100);

function pctTexto(p: number): string {
  return `${String(Math.round(p * 1000) / 10).replace(".", ",")}%`;
}

function diaMes(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}` : null;
}

export function baseDaTaxa(p: { valor: number; percent: number; aluguelMensal: number; meses: number }): BaseTaxa {
  if (!(p.percent > 0) || !(p.aluguelMensal > 0)) return "outra";
  const v = centavos(p.valor);
  if (Math.abs(v - centavos(p.aluguelMensal * Math.max(1, p.meses) * p.percent)) <= 1) return "valor_total";
  if (Math.abs(v - centavos(p.aluguelMensal * p.percent)) <= 1) return "um_mes";
  return "outra";
}

/** "R$ 3.200" / "R$ 259,20" (mesmo formato do rotuloTaxaServico de cobranca/regra.ts). */
function brl(v: number): string {
  const inteiro = Math.abs(v - Math.round(v)) < 0.005;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 })}`;
}

/** "12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800)" (prompt 27) · "12% de 1 mês — regra vigente no aceite em 12/10" · "12% — valor registrado no aceite". */
export function rotuloBaseTaxa(p: { valor: number; percent: number; aluguelMensal: number; meses: number; aceiteEm?: string | null }): string {
  const base = baseDaTaxa(p);
  const pct = pctTexto(p.percent);
  const dia = diaMes(p.aceiteEm);
  if (base === "valor_total") {
    const m = Math.max(1, Math.round(p.meses));
    return `${pct} sobre o valor mensal × meses (${brl(p.aluguelMensal)} × ${m} = ${brl(Math.round(p.aluguelMensal * m * 100) / 100)})`;
  }
  if (base === "um_mes") return `${pct} de 1 mês — regra vigente no aceite${dia ? ` em ${dia}` : ""}`;
  return p.percent > 0 ? `${pct} — valor registrado no aceite${dia ? ` em ${dia}` : ""}` : "valor registrado no aceite";
}
