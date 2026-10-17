/*
  Varredura de texto (ordem 0569d129, item 1): o fechamento do dono diz "valor mensal", não "aluguel",
  ao explicar a taxa Viva. Roda: node --test src/lib/sem-aluguel-fechamento.test.ts
*/
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

test('fechamento do dono: "(valor mensal × meses)" e não "(aluguel × meses)"', () => {
  const txt = readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8");
  assert.doesNotMatch(txt, /<strong>[^<]*<\/strong>\s*\(aluguel/);
  assert.match(txt, /\(valor mensal × meses\)/);
});

test("specs do lab a partir da t100 não repetem número (as repetições antigas t30/t55 etc. ficam como estão)", () => {
  const nomes = readdirSync("tests/e2e/specs").filter((n) => /^t\d{3,}-.*\.spec\.ts$/.test(n));
  const por = new Map<string, string[]>();
  for (const n of nomes) {
    const k = n.match(/^t(\d+)-/)![1];
    por.set(k, [...(por.get(k) ?? []), n]);
  }
  const repetidos = [...por.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `t${k}: ${v.join(", ")}`);
  assert.deepEqual(repetidos, []);
});
