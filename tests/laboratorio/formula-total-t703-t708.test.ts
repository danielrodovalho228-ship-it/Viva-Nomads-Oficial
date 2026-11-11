import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o cartão lateral desenha a conta do total em lista (FormulaDoTotal); t703/t708 normalizam as quebras de linha.
test("FormulaDoTotal desenha uma parcela por linha, com '+ ' nas seguintes", () => {
  const s = readFileSync("src/components/property/formula-total.tsx", "utf8");
  assert.match(s, /<li>\{i === 0 \? p : `\+ \$\{p\}`\}<\/li>/);
});
for (const f of ["t703-e254-estadia-minima", "t708-e254-estadia-minima-uma-fonte"]) {
  test(`${f}: a conta do cartão lateral é lida com as quebras de linha viradas em espaço`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.match(s, /cartao-lateral-estadia-conta"\)\.innerText\(\)\)\.trim\(\)\.replace\(\/\\s\*\\n\\s\*\/g, " "\)/);
  });
}

test("FormulaDoTotal põe um espaço entre as parcelas (o texto lido não cola 'R$ 3.450+ limpeza')", () => {
  const s = readFileSync("src/components/property/formula-total.tsx", "utf8");
  assert.match(s, /<Fragment key=\{i\}>\s*\{i > 0 && " "\}\s*<li>/);
});
test("t610: o nome de quem sai também traz o sobrenome", () => {
  assert.match(readFileSync("tests/e2e/specs/t610-e190p2-hoje-no-inicio.spec.ts", "utf8"), /toHaveText\(\/\^Bruno\( \\w\+\)\?\$\/\)/);
});
