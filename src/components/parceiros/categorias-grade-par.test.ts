/* Grade par (31/10): no "Quero ser parceiro", com número ímpar de categorias a última ocupa a linha inteira.
   Roda: node --test src/components/parceiros/categorias-grade-par.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("categorias do Seja parceiro: grade de 2 com a última ímpar em col-span-2", () => {
  const c = readFileSync(new URL("./seja-parceiro-form.tsx", import.meta.url), "utf8");
  assert.match(c, /className="mt-1 grid grid-cols-2 gap-2" data-testid="sp-categorias"/);
  assert.match(c, /rounded-lg border border-sage-200 bg-white px-3 text-sm text-ink odd:last:col-span-2"/);
});
