/** Testes do simulador tributário PF × PJ — travam as saídas que a memória de
 *  cálculo (/tributario) documenta, e garantem PARIDADE (Conta e /tributario
 *  chamam a MESMA função → mesmo resultado). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateTax, irpfMensal, PF_CONTRIBUTOR_MIN_ANNUAL } from "./tax.ts";
import { simulateTax as simulateTaxMemoria } from "./tributario.ts";

test("PF de 1 imóvel a R$ 3.200/mês: carnê-leão progressivo, sem IBS/CBS", () => {
  const r = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  assert.equal(r.annualRevenue, 38400);
  assert.equal(r.pfIsContributor, false);
  // 3.200 × 15% − 394,16 = 85,84/mês → 1.030/ano (antes: 27,5% fixo = 10.560).
  assert.equal(r.pfAnnualTax, 1030);
});

test("tabela progressiva mensal: faixas e parcela a deduzir", () => {
  assert.equal(irpfMensal(2000), 0); // isento
  assert.equal(Math.round(irpfMensal(10000) * 100) / 100, 1841.27); // 27,5% − 908,73
  assert.equal(irpfMensal(-50), 0);
});

test("R$ 10 mil/mês: PF ~R$ 22 mil/ano (não R$ 33 mil) e diferença real ~R$ 6,6 mil", () => {
  const r = simulateTax({ monthlyRent: 10000, propertyCount: 1 });
  assert.equal(r.pfAnnualTax, 22095);
  assert.equal(r.pjAnnualTax, 15252);
  assert.equal(r.taxSavings, 6843);
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
  assert.ok(r.taxSavings > 5000);
  assert.equal(r.recommendation, "pj");
  const quase = simulateTax({ monthlyRent: 10000, propertyCount: 1, monthlyDeductions: 3000 });
  assert.equal(quase.recommendation, quase.taxSavings > 5000 ? "pj" : "pf");
});

test("PARIDADE: Conta e /tributario produzem resultado idêntico (mesma função)", () => {
  const input = { monthlyRent: 4500, propertyCount: 2 };
  assert.deepEqual(simulateTax(input), simulateTaxMemoria(input));
});
