import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rodada completa do lab 10/11 (5eb1fad9): t816 a 1280 px esperava o último bairro com menos de metade da linha e mediu
// a linha inteira (1160 de 1160 px). A "varredura 23" mudou a grade de propósito: no computador (6 colunas de 2), com 1
// bairro sobrando o último ocupa a linha; com 2 sobrando, os dois dividem a linha. A spec passa a cobrar essa regra.
test("t816: a 1280 px a spec cobra a regra da varredura 23 (sobra 1 = linha inteira; sobra 2 = meia linha)", () => {
  const pagina = readFileSync("src/app/(public)/cidades/[cidade]/page.tsx", "utf8");
  assert.ok(pagina.includes("lg:[&>:last-child:nth-child(3n+1)]:col-span-6"));
  assert.ok(pagina.includes("lg:[&>:last-child:nth-child(3n+2)]:col-span-3"));
  const spec = readFileSync("tests/e2e/specs/t816-cidade-bairros-grade-par.spec.ts", "utf8");
  assert.doesNotMatch(spec, /if \(colunas === 3\) expect\(ultimo\)\.toBeLessThan\(total \* 0\.5\)/);
  assert.match(spec, /n % 3 === 1/);
  assert.match(spec, /n % 3 === 2/);
});
