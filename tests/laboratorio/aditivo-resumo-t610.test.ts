import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o resumo do aditivo agora traz também "Saída" e "Dias" depois de "Meses: de X para Y"; o nome do cartão "Hoje" traz a inicial do sobrenome.
const SPECS = ["t256-pagina-da-estadia", "t595-e205b2-lembrete-no-aceite", "t631-e222b-renovar-aditivo", "t712-e267-transacionais-corpo"];
for (const f of SPECS) {
  test(`${f}: o resumo do aditivo é conferido por prefixo`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.doesNotMatch(s, /aditivo-resumo"\)\)\.toHaveText\("Meses/);
    assert.match(s, /aditivo-resumo"\)\)\.toContainText\("Meses: de \d para \d"\)/);
  });
}
test("t610: o nome do cartão 'Hoje' aceita a inicial do sobrenome", () => {
  assert.match(readFileSync("tests/e2e/specs/t610-e190p2-hoje-no-inicio.spec.ts", "utf8"), /toHaveText\(\/\^Iara\(/);
});
