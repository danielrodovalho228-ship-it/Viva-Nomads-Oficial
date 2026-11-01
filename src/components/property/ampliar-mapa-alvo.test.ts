/* Roda: node --test src/components/property/ampliar-mapa-alvo.test.ts — varredura 01/11 (Pista A): o botão "Ampliar mapa"
   do anúncio media 32 px de altura sobre o mapa (alvo de toque abaixo de 44 px no celular). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./location-nearby.tsx", import.meta.url), "utf8");

test("'Ampliar mapa' tem altura mínima de 44 px", () => {
  const botao = src.slice(src.indexOf('data-testid="ampliar-mapa"'), src.indexOf("Ampliar mapa\n"));
  assert.match(botao, /min-h-11/);
  assert.doesNotMatch(botao, /\bpy-2\b/);
});

test("sem base de mapa, 'Ampliar mapa' não é renderizado (o aviso do E419 o cobria)", async () => {
  assert.match(src, /const semBase = mapaSemBase\(\);/);
  assert.match(src, /\{!semBase && \(/);
  const { mapaSemBase } = await import("../../lib/mapa-base.ts");
  assert.equal(mapaSemBase(undefined, null), true);
  assert.equal(mapaSemBase(undefined, "https://tiles"), false);
  assert.equal(mapaSemBase("tok", null), false);
});
