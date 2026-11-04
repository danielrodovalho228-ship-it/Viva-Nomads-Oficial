/**
 * Varredura (Pista A, 04/11, 1280): na página do imóvel, "Avaliações" com 3 avaliações deixava a terceira sozinha numa
 * grade de 2 colunas (buraco ao lado) — fora da regra da grade par. Com número ímpar, a última ocupa a linha inteira
 * (o mesmo padrão do E495). Vale para as avaliações de exemplo e para as reais. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const REGRA = /className="mt-4 grid gap-4 sm:grid-cols-2 sm:\[&>:last-child:nth-child\(odd\)\]:col-span-full"/;

test("avaliações de exemplo: grade par (a última ímpar ocupa a linha)", () => {
  assert.match(ler("./avaliacoes-exemplo.tsx"), REGRA);
});

test("avaliações reais: grade par (a última ímpar ocupa a linha)", () => {
  assert.match(ler("./reviews.tsx"), REGRA);
});
