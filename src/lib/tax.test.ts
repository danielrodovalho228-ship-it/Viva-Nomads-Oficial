/** Testes do simulador tributário PF × PJ — travam as saídas que a memória de
 *  cálculo (/tributario) documenta, e garantem PARIDADE (Conta e /tributario
 *  chamam a MESMA função → mesmo resultado). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateTax, IRPF_RATE, PF_CONTRIBUTOR_MIN_ANNUAL } from "./tax.ts";
import { simulateTax as simulateTaxMemoria } from "./tributario.ts";

test("PF de 1 imóvel a R$ 3.200/mês NÃO é contribuinte de IBS/CBS", () => {
  const r = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  assert.equal(r.annualRevenue, 38400);
  assert.equal(r.pfIsContributor, false);
  assert.equal(r.pfRate, IRPF_RATE); // alíquota única, sem IBS/CBS
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

test("recomendação vira PJ quando a economia supera o custo de manter a PJ", () => {
  const r = simulateTax({ monthlyRent: 3200, propertyCount: 1 });
  // PF paga mais que PJ (alíquota única alta) → economia > R$ 5.000 → recomenda PJ.
  assert.ok(r.pfAnnualTax > r.pjAnnualTax);
  assert.equal(r.recommendation, "pj");
  assert.equal(r.needsNfse, true);
});

test("PARIDADE: Conta e /tributario produzem resultado idêntico (mesma função)", () => {
  const input = { monthlyRent: 4500, propertyCount: 2 };
  assert.deepEqual(simulateTax(input), simulateTaxMemoria(input));
});
