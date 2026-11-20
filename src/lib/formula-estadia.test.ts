/* E696 — a fórmula do total da estadia em linhas legíveis, com o total inteiro numa linha própria. Roda: node --test src/lib/formula-estadia.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partirFormula } from "./formula-estadia.ts";

test("a conta de dias vira uma parcela por linha e o total sozinho (o '+' do período não quebra)", () => {
  const f = partirFormula("R$ 3.960 × 43 dias ÷ 30 (1 mês + 13 dias) + limpeza de preparação R$ 450 + limpeza de saída R$ 250", "R$ 6.376");
  assert.deepEqual(f.parcelas, ["R$ 3.960 × 43 dias ÷ 30 (1 mês + 13 dias)", "limpeza de preparação R$ 450", "limpeza de saída R$ 250"]);
  assert.equal(f.total, "R$ 6.376");
});

test("conta que já traz o '= total' na frase: o total sai da frase", () => {
  const f = partirFormula("R$ 4.200 × 3 meses + limpeza de saída R$ 250 = R$ 12.850");
  assert.deepEqual(f.parcelas, ["R$ 4.200 × 3 meses", "limpeza de saída R$ 250"]);
  assert.equal(f.total, "R$ 12.850");
});

test("sem '+' nem total: uma parcela só; total nulo", () => {
  assert.deepEqual(partirFormula("R$ 3.960 × 2 meses"), { parcelas: ["R$ 3.960 × 2 meses"], total: null });
  assert.deepEqual(partirFormula(""), { parcelas: [], total: null });
});

test("o cartão de preço usa a fórmula em linhas, com o total que não quebra no meio", () => {
  const card = readFileSync(new URL("../components/property/price-card.tsx", import.meta.url), "utf8");
  assert.match(card, /<FormulaDoTotal\b/);
  assert.doesNotMatch(card, /\{estadiaDias\.conta\} = \{formatBRLExato/);
  const comp = readFileSync(new URL("../components/property/formula-total.tsx", import.meta.url), "utf8");
  assert.match(comp, /whitespace-nowrap/);
  assert.match(comp, /data-testid="formula-total"/);
});
