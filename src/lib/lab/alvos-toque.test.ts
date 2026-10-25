import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { alvoPequeno, descreverAlvos, rolagemLateral, temRolagemLateral } from "./alvos-toque.ts";

test("rolagem lateral: até 1 px de arredondamento passa; mais que isso reprova", () => {
  assert.equal(temRolagemLateral(390, 390), false);
  assert.equal(temRolagemLateral(391, 390), false);
  assert.equal(temRolagemLateral(412, 390), true);
  assert.equal(rolagemLateral(380, 390), 0);
});

test("alvo de toque: 44 px de altura passa, 32 px reprova, link largo e baixo de texto corrido não conta", () => {
  assert.equal(alvoPequeno({ seletor: "a", largura: 100, altura: 44 }), false);
  assert.equal(alvoPequeno({ seletor: "button", largura: 40, altura: 32 }), true);
  assert.equal(alvoPequeno({ seletor: "a", largura: 300, altura: 32 }), false);
});

test("a descrição traz seletor e medida, sem HTML, e respeita o limite", () => {
  const lista = Array.from({ length: 12 }, (_, i) => ({ seletor: `button#b${i}`, largura: 30, altura: 30 }));
  const texto = descreverAlvos(lista, 3);
  assert.equal(texto.split("\n").length, 3);
  assert.match(texto, /button#b0 30x30/);
  assert.doesNotMatch(texto, /<[a-z]/i);
});

test("o spec t259 existe e usa a regra pura nas rotas do axe", () => {
  const f = "tests/e2e/specs/t259-largura-e-alvos.spec.ts";
  assert.ok(existsSync(f));
  const s = readFileSync(f, "utf8");
  assert.match(s, /alvos-toque/);
  assert.match(s, /ROTAS_AXE_PUBLICAS/);
});
