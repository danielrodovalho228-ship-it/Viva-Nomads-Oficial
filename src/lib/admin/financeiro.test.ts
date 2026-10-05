/*
  /admin/financeiro: MRR, churn, ARPU, LTV, CAC, ROI, take rate e CSV honestos.
  Roda: node --test src/lib/admin/financeiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularFinanceiro, csvFinanceiro, mesCurto } from "./financeiro.ts";

const BASE = {
  historico_desde: "2026-10-05T10:00:00Z",
  assinaturas: {
    agora: { essential: 2, pro: 1 },
    inicio: null,
    fim: { essential: 2, pro: 1 },
    novas: 2,
    saidas: 1,
    ativas_30d_antes: 4,
    saidas_30d: 1,
  },
  recebido: { assinatura: 227, comissao: 320 },
  comissoes: [
    { contrato: "c1", data: "2026-10-01", imovel: "Apto", cidade: "Uberlândia", plano: "pro", percentual: 0.08, aluguel: 4000, comissao: 320, status: "pago", pago_em: "2026-10-02" },
    { contrato: "c2", data: "2026-10-03", imovel: "Casa; centro", cidade: "Uberlândia", plano: "free", percentual: 0.12, aluguel: 2000, comissao: 240, status: "vencido", pago_em: null },
  ],
  marketing: { gasto: 500, meses: ["2026-10"], novos_proprietarios: 5 },
  mensal: [
    { mes: "2026-09", receita_assinatura: 0, receita_comissao: 0, gasto_marketing: 0, novos_proprietarios: 1, assinaturas_fim_mes: null },
    { mes: "2026-10", receita_assinatura: 227, receita_comissao: 320, gasto_marketing: 500, novos_proprietarios: 5, assinaturas_fim_mes: { essential: 2, pro: 1 } },
  ],
};

test("MRR/ARR pelos preços da fonte única", () => {
  const f = calcularFinanceiro(BASE);
  assert.equal(f.mrrAgora, 49 * 2 + 129);
  assert.equal(f.arr, (49 * 2 + 129) * 12);
  assert.equal(f.ativas, 3);
});

test("início antes do histórico → null (—), nunca 0", () => {
  const f = calcularFinanceiro(BASE);
  assert.equal(f.mrrInicio, null);
  assert.equal(f.mensal[0].mrrFimMes, null);
  assert.equal(f.mensal[1].mrrFimMes, 227);
});

test("churn, ARPU e LTV", () => {
  const f = calcularFinanceiro(BASE);
  assert.equal(f.churnMensal, 0.25);
  assert.equal(f.arpu, 227 / 3);
  assert.equal(f.ltv, 227 / 3 / 0.25);
});

test("churn zero ou sem histórico: LTV é — (nunca infinito)", () => {
  const zero = calcularFinanceiro({ ...BASE, assinaturas: { ...BASE.assinaturas, saidas_30d: 0 } });
  assert.equal(zero.churnMensal, 0);
  assert.equal(zero.ltv, null);
  const semHist = calcularFinanceiro({ ...BASE, assinaturas: { ...BASE.assinaturas, saidas_30d: null, ativas_30d_antes: null } });
  assert.equal(semHist.churnMensal, null);
  assert.equal(semHist.ltv, null);
});

test("comissões: gerada, a receber, take rate", () => {
  const f = calcularFinanceiro(BASE);
  assert.equal(f.comissaoGerada, 560);
  assert.equal(f.comissaoAReceber, 240);
  assert.equal(f.aluguelContratado, 6000);
  assert.equal(f.takeRate, 560 / 6000);
});

test("CAC e ROI; sem gasto lançado → —", () => {
  const f = calcularFinanceiro(BASE);
  assert.equal(f.cac, 100);
  assert.equal(f.roi, (547 - 500) / 500);
  const semGasto = calcularFinanceiro({ ...BASE, marketing: { gasto: 0, meses: [], novos_proprietarios: 3 } });
  assert.equal(semGasto.cac, null);
  assert.equal(semGasto.roi, null);
  const semNovos = calcularFinanceiro({ ...BASE, marketing: { gasto: 500, meses: [], novos_proprietarios: 0 } });
  assert.equal(semNovos.cac, null);
});

test("filtro de cidade (assinaturas/marketing null) e JSON vazio não geram NaN", () => {
  for (const d of [{ ...BASE, assinaturas: null, marketing: null, recebido: { assinatura: null, comissao: 0 } }, {}, null]) {
    const f = calcularFinanceiro(d as never);
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} = ${v}`);
    }
    assert.equal(f.takeRate === null || Number.isFinite(f.takeRate), true);
  }
  const vazio = calcularFinanceiro({});
  assert.equal(vazio.mrrAgora, null);
  assert.equal(vazio.takeRate, null); // sem contrato: — (não 0%)
});

test("CSV: indicadores, comissões (com ; escapado) e mensal; aluguel avisado", () => {
  const csv = csvFinanceiro(calcularFinanceiro(BASE), "2026-09-06", "2026-10-05", null);
  assert.match(csv, /^# financeiro 2026-09-06 a 2026-10-05/);
  assert.match(csv, /não passa pela plataforma/);
  assert.match(csv, /"Casa; centro"/);
  assert.match(csv, /c2;2026-10-03;.*;Vencida;/);
  assert.match(csv, /2026-09;0;0;0;0;1;\n/);
  assert.doesNotMatch(csv, /NaN|Infinity|undefined/);
});

test("mês curto", () => {
  assert.equal(mesCurto("2026-09"), "set/2026");
});
