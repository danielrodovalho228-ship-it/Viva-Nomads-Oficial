/*
  E292 — "a Viva só conecta" (diretriz do Daniel de 31/10): o simulador PF × PJ do dono não mostra números próprios da
  Viva. Começa vazio (sem receita nem nº de imóveis de exemplo), o custo de manter a empresa é o que o dono digita e as
  alíquotas são as da lei. O aviso de IBS/CBS segue atrás da chave desligada (portão do parecer).
  Roda: node --test src/lib/e292-numeros-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_IBS_CBS_LIBERADO, PJ_ACCOUNTING_YEAR, simulateTax } from "./tax.ts";

const TELA = readFileSync(new URL("../components/tax-simulator.tsx", import.meta.url), "utf8");

test("o custo de manter a empresa é o digitado pelo dono (zero vale zero); sem ele, a memória interna usa a referência", () => {
  const base = { monthlyRent: 8000, propertyCount: 2 };
  assert.equal(simulateTax({ ...base, pjAnnualCost: 3600 }).pjAnnualCost, 3600);
  assert.equal(simulateTax({ ...base, pjAnnualCost: 0 }).pjAnnualCost, 0);
  assert.equal(simulateTax({ ...base, pjAnnualCost: -10 }).pjAnnualCost, 0);
  assert.equal(simulateTax(base).pjAnnualCost, PJ_ACCOUNTING_YEAR);
  // A vantagem da PJ desconta exatamente o custo digitado.
  const r = simulateTax({ ...base, pjAnnualCost: 3600 });
  assert.equal(r.taxSavings, r.taxDifference - 3600);
  // Sem receita, nenhum custo.
  assert.equal(simulateTax({ monthlyRent: 0, propertyCount: 0, pjAnnualCost: 3600 }).pjAnnualCost, 0);
});

test("a tela começa vazia, passa o custo do dono e só mostra os cenários depois da receita digitada", () => {
  assert.match(TELA, /useState\(0\);\n\s*const \[propertyCount, setPropertyCount\] = useState\(0\);/);
  assert.doesNotMatch(TELA, /useState\(10000\)|useState\(4\)/);
  assert.match(TELA, /pjAnnualCost: limitar\(custoEmpresa, MAX_RECEITA_CARTEIRA\)/);
  assert.match(TELA, /testid="tax-custo-empresa"/);
  assert.doesNotMatch(TELA, /PJ_ACCOUNTING_YEAR/);
  assert.match(TELA, /r\.annualRevenue <= 0 \? \(\s*<p[^>]*data-testid="tax-sem-receita"/);
  assert.match(TELA, /custo de manter a empresa que você informou/);
});

test("portão do parecer: o aviso de IBS/CBS continua desligado e a tela continua dependendo da chave", () => {
  assert.equal(AVISO_IBS_CBS_LIBERADO, false);
  assert.match(TELA, /\{AVISO_IBS_CBS_LIBERADO && r\.ibsCbsAviso && \(/);
});
