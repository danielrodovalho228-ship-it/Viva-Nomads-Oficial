import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDaTaxa, rotuloBaseTaxa } from "./taxa-servico-base.ts";

// Prompt 23 (item 4). O contrato de produção de 12/10: R$ 3.200 × 4 meses, 12%, taxa gravada R$ 384 (= 1 mês).
test("p23 — contrato ANTIGO (taxa sobre 1 mês) mostra a regra vigente no aceite", () => {
  const antigo = { valor: 384, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-12T18:57:58Z" };
  assert.equal(baseDaTaxa(antigo), "um_mes");
  assert.equal(rotuloBaseTaxa(antigo), "12% de 1 mês — regra vigente no aceite em 12/10");
});

test("p23 — contrato NOVO (taxa sobre o valor total) mostra '12% do valor total'", () => {
  const novo = { valor: 1536, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-18T10:00:00Z" };
  assert.equal(baseDaTaxa(novo), "valor_total");
  assert.equal(rotuloBaseTaxa(novo), "12% do valor total");
  assert.equal(rotuloBaseTaxa({ valor: 720, percent: 0.08, aluguelMensal: 3000, meses: 3 }), "8% do valor total");
});

test("p23 — valor que não bate com nenhuma regra não inventa base", () => {
  assert.equal(rotuloBaseTaxa({ valor: 500, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-12" }), "12% — valor registrado no aceite em 12/10");
});

test("p23 — a tela usa 'taxa de serviço' (nunca 'comissão') e não afirma regra de renovação", () => {
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/contratos/contratos-client.tsx", import.meta.url), "utf8");
  const bloco = tela.slice(tela.indexOf('data-testid="contrato-taxa"'), tela.indexOf('data-testid="contrato-taxa"') + 700);
  assert.match(bloco, /Taxa de serviço do contrato/);
  assert.doesNotMatch(bloco, /[Cc]omissão/);
  assert.doesNotMatch(bloco, /renova/);
  assert.match(tela, /rotuloBaseTaxa\(/);
});
