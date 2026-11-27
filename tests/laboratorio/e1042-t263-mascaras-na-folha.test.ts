/*
  E1042 (ORDEM-DUET-246, 20/11/2026): defeito do teste, não do produto. O t263 fotografa a folha "Ações desta estadia"
  (um elemento) e procurava o que mascarar na página INTEIRA. O Playwright pinta a máscara de tudo o que casa e se
  sobrepõe à caixa fotografada, mesmo o que está POR TRÁS da folha: quando a página por baixo muda de altura (a pílula
  do #3880), uma máscara da página passa a tapar o título da folha. A correção: na captura da folha, as máscaras são
  procuradas dentro da folha.
  Roda: node --test tests/laboratorio/e1042-t263-mascaras-na-folha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync(new URL("../e2e/specs/t263-visual-41.spec.ts", import.meta.url).pathname, "utf8");

test("t263: a captura da folha da estadia mascara só o que está dentro da folha", () => {
  assert.match(spec, /await expect\(folha\)\.toHaveScreenshot\(nome, \{ mask: mascaras\(folha\) \}\);/);
  assert.doesNotMatch(spec, /expect\(folha\)\.toHaveScreenshot\([^)]*mascaras\(page\)/, "a folha não volta a ser mascarada pela página inteira");
});

test("t263: mascaras() aceita a página ou um elemento, e procura tudo a partir dele", () => {
  assert.match(spec, /function mascaras\(raiz: Page \| Locator\): Locator\[\] \{/);
  const corpo = spec.slice(spec.indexOf("function mascaras("), spec.indexOf("async function pronta("));
  assert.equal((corpo.match(/raiz\.locator\(/g) ?? []).length, 8, "os 8 grupos de máscara continuam lá");
  assert.doesNotMatch(corpo, /page\.locator\(/, "nenhum grupo fica preso à página inteira");
});
