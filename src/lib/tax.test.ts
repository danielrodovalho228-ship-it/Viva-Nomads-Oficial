/** Testes do simulador tributário PF × PJ — travam as saídas que a memória de
 *  cálculo (/tributario) documenta, e garantem PARIDADE (Conta e /tributario
 *  chamam a MESMA função → mesmo resultado). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateTax, irpfMensal, irpfMensalTabela, PF_CONTRIBUTOR_MIN_ANNUAL, AVISO_IBS_CBS_LIBERADO, AVISO_IBS_CBS_PF } from "./tax.ts";
import { simulateTax as simulateTaxMemoria } from "./tributario.ts";

test("PF de 1 imóvel a R$ 3.200/mês: redutor da Lei 15.270 zera o carnê-leão", () => {
  const r = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  assert.equal(r.annualRevenue, 38400);
  assert.equal(r.pfIsContributor, false);
  // Antes: 3.200 × 15% − 394,16 = 85,84/mês → R$ 1.030/ano. Com o redutor
  // (rendimento até R$ 5.000/mês), o imposto é zero.
  assert.equal(r.pfAnnualTax, 0);
});

test("tabela progressiva mensal: faixas e parcela a deduzir (sem redutor)", () => {
  assert.equal(irpfMensalTabela(2000), 0); // isento
  assert.equal(Math.round(irpfMensalTabela(3200) * 100) / 100, 85.84);
  assert.equal(Math.round(irpfMensalTabela(10000) * 100) / 100, 1841.27); // 27,5% − 908,73
  assert.equal(irpfMensal(-50), 0);
});

test("redutor da Lei 15.270: zero até R$ 5.000, decrescente até R$ 7.350, nada acima", () => {
  assert.equal(irpfMensal(5000), 0);
  // 6.000: tabela 741,27 − redução (978,62 − 0,133145 × 6.000 = 179,75) = 561,52
  assert.equal(Math.round(irpfMensal(6000) * 100) / 100, 561.52);
  // 7.350: redução zero → imposto da tabela
  assert.equal(Math.round(irpfMensal(7350) * 100) / 100, Math.round(irpfMensalTabela(7350) * 100) / 100);
  assert.equal(Math.round(irpfMensal(10000) * 100) / 100, 1841.27);
});

test("R$ 10 mil/mês: PF ~R$ 22 mil/ano; PJ presumido 11,33% (IBS/CBS 2026 = teste compensável)", () => {
  const r = simulateTax({ monthlyRent: 10000, propertyCount: 1 });
  assert.equal(r.pfAnnualTax, 22095);
  assert.equal(r.pjAnnualTax, 13596); // 120.000 × 11,33%
  assert.equal(r.taxDifference, 8499);
  // Prompt 18: a vantagem real desconta o custo de manter a empresa (~R$ 5 mil/ano).
  assert.equal(r.pjAnnualCost, 5000);
  assert.equal(r.taxSavings, 3499);
});

test("despesas dedutíveis reduzem o imposto da PF", () => {
  const sem = simulateTax({ monthlyRent: 10000, propertyCount: 1 });
  const com = simulateTax({ monthlyRent: 10000, propertyCount: 1, monthlyDeductions: 2000 });
  assert.ok(com.pfAnnualTax < sem.pfAnnualTax);
  assert.equal(com.pjAnnualTax, sem.pjAnnualTax); // PJ presumido não muda
});

test("PF vira contribuinte só com 4+ imóveis E receita anual > limiar (regra cumulativa)", () => {
  // Muitos imóveis mas receita baixa → NÃO contribuinte.
  assert.equal(simulateTax({ monthlyRent: 1000, propertyCount: 6 }).pfIsContributor, false);
  // Receita alta mas poucos imóveis → NÃO contribuinte.
  assert.equal(simulateTax({ monthlyRent: 30000, propertyCount: 1 }).pfIsContributor, false);
  // Os dois gatilhos → contribuinte.
  const alto = simulateTax({ monthlyRent: 25000, propertyCount: 4 });
  assert.ok(alto.annualRevenue > PF_CONTRIBUTOR_MIN_ANNUAL);
  assert.equal(alto.pfIsContributor, true);
});

test("aluguel moderado: PF paga menos e a recomendação é PF", () => {
  const r = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  assert.ok(r.pfAnnualTax < r.pjAnnualTax);
  assert.equal(r.recommendation, "pf");
});

test("recomendação só vira PJ quando a economia supera o custo de manter a PJ", () => {
  const r = simulateTax({ monthlyRent: 10000, propertyCount: 1 });
  assert.ok(r.taxDifference > 5000);
  assert.equal(r.recommendation, "pj");
  const quase = simulateTax({ monthlyRent: 10000, propertyCount: 1, monthlyDeductions: 3000 });
  assert.equal(quase.recommendation, quase.taxSavings > 0 ? "pj" : "pf");
});

test("PARIDADE: Conta e /tributario produzem resultado idêntico (mesma função)", () => {
  const input = { monthlyRent: 4500, propertyCount: 2 };
  assert.deepEqual(simulateTax(input), simulateTaxMemoria(input));
});

test("prompt 18 — outros rendimentos: o aluguel soma ao salário na tabela (o imposto do aluguel sobe)", () => {
  const so = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  const com = simulateTax({ monthlyRent: 3200, propertyCount: 1, otherMonthlyIncome: 8000 });
  assert.equal(so.pfAnnualTax, 0); // sozinho, o redutor zera
  assert.ok(com.pfAnnualTax > 9000); // 3.200 por mês na faixa de 27,5% ≈ R$ 880/mês
  assert.equal(com.pfAnnualTax, Math.round((irpfMensal(11200) - irpfMensal(8000)) * 12));
});

test("prompt 18 — PJ sem '+ IBS/CBS' e aviso de IBS/CBS só pela regra cumulativa (desligado até a revisão)", () => {
  const r = simulateTax({ monthlyRent: 10000, propertyCount: 1 });
  assert.equal(r.pjRate, 0.1133);
  assert.equal(r.ibsCbsAviso, false);
  assert.equal(simulateTax({ monthlyRent: 25000, propertyCount: 4 }).ibsCbsAviso, true);
  assert.equal(simulateTax({ monthlyRent: 25000, propertyCount: 3 }).ibsCbsAviso, false);
  assert.equal(AVISO_IBS_CBS_LIBERADO, false);
  assert.match(AVISO_IBS_CBS_PF.texto, /a partir de 2027|começa em 2027/);
  assert.doesNotMatch(AVISO_IBS_CBS_PF.texto, /ago\/2026/);
});
