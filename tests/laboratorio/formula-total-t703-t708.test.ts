import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o cartão lateral desenha a conta do total em lista (FormulaDoTotal); t703/t708 normalizam as quebras de linha.
test("FormulaDoTotal desenha uma parcela por linha, com '+ ' nas seguintes", () => {
  const s = readFileSync("src/components/property/formula-total.tsx", "utf8");
  assert.match(s, /<li key=\{i\}>\{i === 0 \? p : `\+ \$\{p\}`\}<\/li>/);
});
for (const f of ["t703-e254-estadia-minima", "t708-e254-estadia-minima-uma-fonte"]) {
  test(`${f}: a conta do cartão lateral é lida com as quebras de linha viradas em espaço`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.match(s, /cartao-lateral-estadia-conta"\)\.innerText\(\)\)\.trim\(\)\.replace\(\/\\s\*\\n\\s\*\/g, " "\)/);
  });
}
