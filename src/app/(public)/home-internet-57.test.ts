/*
  Prompt 57, item 6 (textos públicos sem prova): a home não afirma capacidade de internet que ninguém mediu.
  Roda: node --test "src/app/(public)/home-internet-57.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("home sem 'aguenta videochamadas' nem 'internet boa' declarada", () => {
  assert.doesNotMatch(home, /videochamada/i);
  assert.doesNotMatch(home, /internet boa para o trabalho/i);
  assert.doesNotMatch(home, /declarados pelo proprietário/);
});

test("home diz de onde vem a informação da internet", () => {
  assert.ok(home.includes("Internet informada pelo proprietário; quando medida no imóvel, o anúncio mostra o número."));
});
