/* Roda: node --test "src/app/(public)/proprietario/[id]/grade-par.test.ts" — conformidade visual (02/11): as avaliações do
   proprietário de exemplo, em 2 colunas, usam a grade par da casa (ímpar → a última ocupa a linha inteira). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("avaliações do exemplo em grade-par", () => {
  const src = readFileSync(new URL("./perfil-exemplo.tsx", import.meta.url), "utf8");
  assert.match(src, /className="grade-par mt-4 grid gap-4 lg:grid-cols-2" data-testid="avaliacoes-exemplo"/);
});
