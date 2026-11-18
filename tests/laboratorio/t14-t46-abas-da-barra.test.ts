import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abasDoPapel } from "../../src/lib/nav-mobile.ts";

// E744: os specs t14/t46 conferem as abas da barra; os rótulos têm de ser os da fonte única (abas-painel.ts → nav-mobile.ts).
function rotulos(papel: "morador" | "proprietario") {
  return abasDoPapel(papel, { comContrato: false }).map((t) => t.label);
}
function lista(arquivo: string, nome: string) {
  const m = readFileSync(`tests/e2e/specs/${arquivo}`, "utf8").match(new RegExp(`const ${nome} = (\\[[^\\]]*\\])`));
  assert.ok(m, `${nome} em ${arquivo}`);
  return JSON.parse(m![1]) as string[];
}
test("t14 e t46 esperam as abas reais da barra", () => {
  assert.deepEqual(lista("t14-app-mode.spec.ts", "ABAS_INQUILINO"), rotulos("morador"));
  assert.deepEqual(lista("t14-app-mode.spec.ts", "ABAS_PROPRIETARIO"), rotulos("proprietario"));
  assert.deepEqual(lista("t46-modo-do-app.spec.ts", "ABAS_PROPRIETARIO"), rotulos("proprietario"));
});
