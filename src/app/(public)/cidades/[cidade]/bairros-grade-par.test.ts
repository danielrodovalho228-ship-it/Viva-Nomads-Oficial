/*
  Varredura 02/11 (Pista A), largura de tablet (768 px): na página da cidade, os bairros ficam em 2 colunas e, com
  número ímpar (3 em Uberlândia), sobrava um buraco ao lado do último. Grade par só em 2 colunas.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("bairros da cidade em grade par no tablet (2 colunas)", () => {
  assert.match(src, /<ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:max-lg:\[&>:last-child:nth-child\(odd\)\]:col-span-full lg:grid-cols-3" data-testid="bairros-lista">/);
});
