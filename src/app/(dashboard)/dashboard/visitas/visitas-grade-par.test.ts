/*
  Varredura 02/11 (Pista A, telas da visita): a lista de Visitas usa 2 colunas no computador; com número ímpar de
  visitas sobrava um buraco ao lado da última. Grade par (regra da casa): a última ímpar ocupa a linha inteira.
  Roda: npm test (arquivo visitas-grade-par.test.ts, ao lado da página)
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("lista de Visitas em grade par (dono e morador)", () => {
  assert.match(src, /<div className="grade-par grid gap-3 lg:grid-cols-2">\n\s*\{visitas\.map\(\(v\) => \(/);
});
