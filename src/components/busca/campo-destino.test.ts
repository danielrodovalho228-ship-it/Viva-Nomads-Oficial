import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  t188: todo campo de /pedidos/novo tem 48 px. O "Outro local" tinha h-10 + flex-1 dentro de uma coluna
  (40 px a 1280, 22 px a 390). A altura é h-12 e, na coluna, ocupa a largura (w-full) em vez de flex-1.
*/
const fonte = readFileSync(new URL("./campo-destino.tsx", import.meta.url), "utf8");
const trecho = fonte.slice(fonte.indexOf('id="outro-local-texto"'), fonte.indexOf('data-testid="outro-local-texto"'));

test("campo 'Outro local' tem 48 px (h-12)", () => {
  assert.match(trecho, /\bh-12\b/);
  assert.doesNotMatch(trecho, /\bh-10\b/);
});

test("'Outro local' não usa flex-1 na coluna do celular", () => {
  assert.match(trecho, /\bw-full\b/);
  assert.doesNotMatch(trecho, /(^|\s)flex-1\b/);
  assert.match(trecho, /sm:flex-1/);
});
