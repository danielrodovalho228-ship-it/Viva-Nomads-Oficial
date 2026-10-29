/*
  Lab 13:56 (43a2dd42): t102 falhava com "nem o aviso do rascunho nem o preço sugerido apareceram". O E180 pôs o aviso
  dentro da Qualificação e o E195 trocou o cartão para rounded-xl; a spec achava o aviso por classe (rounded-2xl).
  Agora usa o data-testid, e a cópia local (sem ?draft=) também abre o Preço.
  Roda: node --test src/lib/t102-aviso-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync(new URL("../../tests/e2e/specs/t102-preco-sugerido.spec.ts", import.meta.url), "utf8");

test("t102 acha o aviso do rascunho pelo data-testid, não por classe de estilo", () => {
  assert.match(spec, /getByTestId\("rascunho-continuar"\)/);
  assert.doesNotMatch(spec, /rounded-2xl/);
});

test("t102 não exige ?draft= depois do Continuar (cópia local aplica na própria tela)", () => {
  assert.doesNotMatch(spec, /await page\.waitForURL\(\/\[\?&\]draft=\/\);/);
  assert.match(spec, /comServidor/);
});
