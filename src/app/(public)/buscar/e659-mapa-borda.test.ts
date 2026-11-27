import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E659: o painel do mapa da /buscar não pode estourar a borda direita da janela (1920 px):
// rótulos cortados e atribuição (canto inferior direito) reduzida a uma fatia.
const src = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
const painel = src.match(/data-testid="busca-mapa"\s*className=\{cn\(\s*"([^"]+)"/);

test("E659: painel do mapa sem margem negativa à direita", () => {
  assert.ok(painel, "painel do mapa existe");
  assert.doesNotMatch(painel[1], /-mr-/);
  assert.match(painel[1], /lg:w-\[42%\]/);
});

test("E659: mapa com cantos e borda próprios dentro da margem", () => {
  assert.match(src, /className="h-full w-full rounded-none border-0 border-l border-line lg:rounded-xl lg:border"/);
});
