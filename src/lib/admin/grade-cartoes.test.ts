import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classeDaGrade } from "./grade-cartoes.ts";

const COLUNAS_MAX = (c: string) => Math.max(...[...c.matchAll(/grid-cols-(\d)/g)].map((m) => +m[1]));

test("grade do financeiro: com a largura máxima, nenhuma contagem usada deixa a última linha incompleta", () => {
  for (const n of [9, 3, 6, 4]) {
    const cols = COLUNAS_MAX(classeDaGrade(n));
    assert.equal(n % cols, 0, `${n} cartões em ${cols} colunas deixam buraco`);
  }
});

test("a grade do financeiro não fixa mais 4 colunas para qualquer quantidade", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/admin/financeiro/financeiro-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /xl:grid-cols-4/);
  assert.match(src, /classeDaGrade\(Children\.count\(children\)\)/);
});
