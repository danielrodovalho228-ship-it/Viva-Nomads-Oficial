/*
  /admin/financeiro — regras PURAS dos indicadores de dinheiro. Os números
  vêm de admin_financeiro (0071); o preço dos planos vem da fonte única
  (config/planos.ts, via mrr()). Sem dado → null → "—"; denominador zero
  nunca vira 0%, NaN ou ∞. Testável com node --test.
*/
import { mrr, num, razao, type Num } from "./visao-geral.ts";

export interface ComissaoLinha {
  contrato: string;
  data: string;
  imovel: string | null;
  cidade: string | null;
  plano: string | null;
  percentual: Num;
  aluguel: Num;
  comissao: Num;
  status: string;
  pago_em: string | null;
}

export interface MesFinanceiro {
  mes: string; // AAAA-MM
  receitaAssinatura: Num;
  receitaComissao: Num;
  receitaTotal: Num;
  gastoMarketing: Num;
  novosProprietarios: Num;
  mrrFimMes: Num;
}

export interface Financeiro {
  historicoDesde: string | null;
  mrrAgora: Num;
  arr: Num;
  ativas: Num;
  semPreco: number;
  mrrInicio: Num;
  mrrFim: Num;
  novas: Num;
  saidas: Num;
  churnMensal: Num;
  arpu: Num;
  ltv: Num;
  recebidoAssinatura: Num;
  recebidoComissao: Num;
  recebidoTotal: Num;
  comissaoGerada: Num;
  comissaoAReceber: Num;
  aluguelContratado: Num;
  takeRate: Num;
  gastoMarketing: Num;
  mesesMarketing: string[];
  novosProprietarios: Num;
  cac: Num;
  roi: Num;
  comissoes: ComissaoLinha[];
  mensal: MesFinanceiro[];
}

type Bruto = Record<string, unknown> | null | undefined;

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Soma valores ou null se algum faltar. */
function somaNum(...vs: Num[]): Num {
  return vs.some((v) => v === null) ? null : vs.reduce<number>((a, b) => a + (b as number), 0);
}

export const STATUS_COMISSAO: Record<string, string> = {
  pago: "Paga",
  pendente: "Aguardando pagamento",
  vencido: "Vencida",
  sem_cobranca: "Sem cobrança emitida",
};

/** Transforma o JSON de admin_financeiro nos indicadores da tela. */
export function calcularFinanceiro(d: Bruto): Financeiro {
  const a = obj(d?.assinaturas);
  const recebido = obj(d?.recebido);
  const mk = obj(d?.marketing);

  const agora = a ? mrr(obj(a.agora)) : null;
  const inicio = a && obj(a.inicio) ? mrr(obj(a.inicio)) : null;
  const fim = a && obj(a.fim) ? mrr(obj(a.fim)) : null;

  const mrrAgora = agora ? agora.valor : null;
  const ativas = agora ? agora.ativas : null;
  const churnMensal = a ? razao(num(a.saidas_30d), num(a.ativas_30d_antes)) : null;
  const arpu = mrrAgora === null ? null : razao(mrrAgora, ativas);
  // LTV = ARPU ÷ churn mensal. Churn 0 (ninguém saiu) não vira "infinito": fica "—".
  const ltv = arpu !== null && churnMensal !== null && churnMensal > 0 ? arpu / churnMensal : null;

  const comissoes: ComissaoLinha[] = (Array.isArray(d?.comissoes) ? (d!.comissoes as unknown[]) : []).map((c) => {
    const o = obj(c) ?? {};
    return {
      contrato: String(o.contrato ?? ""),
      data: String(o.data ?? ""),
      imovel: (o.imovel as string | null) ?? null,
      cidade: (o.cidade as string | null) ?? null,
      plano: (o.plano as string | null) ?? null,
      percentual: num(o.percentual),
      aluguel: num(o.aluguel),
      comissao: num(o.comissao),
      status: String(o.status ?? "sem_cobranca"),
      pago_em: (o.pago_em as string | null) ?? null,
    };
  });
  const comissaoGerada = comissoes.reduce((s, c) => s + (c.comissao ?? 0), 0);
  const comissaoAReceber = comissoes
    .filter((c) => c.status !== "pago")
    .reduce((s, c) => s + (c.comissao ?? 0), 0);
  const aluguelContratado = comissoes.reduce((s, c) => s + (c.aluguel ?? 0), 0);

  const recebidoAssinatura = recebido ? num(recebido.assinatura) : null;
  const recebidoComissao = recebido ? num(recebido.comissao) : null;
  const recebidoTotal = somaNum(recebidoAssinatura, recebidoComissao);
  const gastoMarketing = mk ? num(mk.gasto) : null;
  const novosProprietarios = mk ? num(mk.novos_proprietarios) : null;

  const mensal: MesFinanceiro[] = (Array.isArray(d?.mensal) ? (d!.mensal as unknown[]) : []).map((m) => {
    const o = obj(m) ?? {};
    const ra = num(o.receita_assinatura);
    const rc = num(o.receita_comissao);
    const fimMes = obj(o.assinaturas_fim_mes);
    return {
      mes: String(o.mes ?? ""),
      receitaAssinatura: ra,
      receitaComissao: rc,
      receitaTotal: ra === null ? rc : somaNum(ra, rc),
      gastoMarketing: num(o.gasto_marketing),
      novosProprietarios: num(o.novos_proprietarios),
      mrrFimMes: fimMes ? mrr(fimMes).valor : null,
    };
  });

  return {
    historicoDesde: typeof d?.historico_desde === "string" ? d.historico_desde : null,
    mrrAgora,
    arr: mrrAgora === null ? null : mrrAgora * 12,
    ativas,
    semPreco: agora?.semPreco ?? 0,
    mrrInicio: inicio ? inicio.valor : null,
    mrrFim: fim ? fim.valor : null,
    novas: a ? num(a.novas) : null,
    saidas: a ? num(a.saidas) : null,
    churnMensal,
    arpu,
    ltv,
    recebidoAssinatura,
    recebidoComissao,
    recebidoTotal,
    comissaoGerada: comissoes.length ? comissaoGerada : 0,
    comissaoAReceber: comissoes.length ? comissaoAReceber : 0,
    aluguelContratado: comissoes.length ? aluguelContratado : 0,
    takeRate: razao(comissaoGerada, aluguelContratado),
    gastoMarketing,
    mesesMarketing: Array.isArray(mk?.meses) ? (mk!.meses as string[]) : [],
    novosProprietarios,
    // CAC = gasto ÷ proprietários novos (mesmos meses). Sem gasto lançado → "—".
    cac: gastoMarketing !== null && gastoMarketing > 0 ? razao(gastoMarketing, novosProprietarios) : null,
    // ROI = (recebido − gasto) ÷ gasto.
    roi:
      gastoMarketing !== null && gastoMarketing > 0 && recebidoTotal !== null
        ? (recebidoTotal - gastoMarketing) / gastoMarketing
        : null,
    comissoes,
    mensal,
  };
}

/** "set/2026" */
export function mesCurto(aaaamm: string): string {
  const [a, m] = aaaamm.split("-").map(Number);
  if (!a || !m) return aaaamm;
  return new Date(Date.UTC(a, m - 1, 15))
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .replace(". de ", "/")
    .replace(" de ", "/")
    .replace(".", "");
}

// ── CSV ──────────────────────────────────────────────────────────────────────
const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const cru = (v: Num) => (v === null ? "" : String(Math.round(v * 10000) / 10000).replace(".", ","));

export function csvFinanceiro(f: Financeiro, inicio: string, fim: string, cidade: string | null): string {
  const linhas: string[] = [`# financeiro ${inicio} a ${fim}${cidade ? ` · cidade: ${cidade}` : ""}`];
  linhas.push("indicador;valor");
  const ind: [string, Num][] = [
    ["MRR agora", f.mrrAgora],
    ["ARR", f.arr],
    ["Assinaturas ativas", f.ativas],
    ["MRR no início do período", f.mrrInicio],
    ["Assinaturas novas no período", f.novas],
    ["Saídas no período", f.saidas],
    ["Churn mensal (30 dias)", f.churnMensal],
    ["ARPU (R$/mês)", f.arpu],
    ["LTV", f.ltv],
    ["Recebido: assinaturas", f.recebidoAssinatura],
    ["Recebido: comissões", f.recebidoComissao],
    ["Recebido: total", f.recebidoTotal],
    ["Comissão gerada", f.comissaoGerada],
    ["Comissão a receber", f.comissaoAReceber],
    ["Aluguel contratado (entre as partes; não passa pela plataforma)", f.aluguelContratado],
    ["Take rate", f.takeRate],
    ["Gasto de marketing", f.gastoMarketing],
    ["CAC (proprietário)", f.cac],
    ["ROI do marketing", f.roi],
  ];
  for (const [k, v] of ind) linhas.push(`${esc(k)};${cru(v)}`);
  linhas.push("", "contrato;data;imovel;cidade;plano;percentual;aluguel;comissao;status;pago_em");
  for (const c of f.comissoes) {
    linhas.push(
      [c.contrato, c.data, esc(c.imovel ?? ""), esc(c.cidade ?? ""), c.plano ?? "", cru(c.percentual), cru(c.aluguel), cru(c.comissao), STATUS_COMISSAO[c.status] ?? c.status, c.pago_em ?? ""].join(";")
    );
  }
  linhas.push("", "mes;receita_assinatura;receita_comissao;receita_total;gasto_marketing;novos_proprietarios;mrr_fim_mes");
  for (const m of f.mensal) {
    linhas.push([m.mes, cru(m.receitaAssinatura), cru(m.receitaComissao), cru(m.receitaTotal), cru(m.gastoMarketing), cru(m.novosProprietarios), cru(m.mrrFimMes)].join(";"));
  }
  return linhas.join("\n");
}
