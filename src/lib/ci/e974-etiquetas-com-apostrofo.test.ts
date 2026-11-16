/*
  E974 — a leitura das etiquetas parava no primeiro apóstrofo e escondia @E da prova automática (t2050: título com
  "Emite nota fiscal…" e um apóstrofo; t2052 escondia o @E631). Regra: o título vai até a MESMA aspa que o abriu,
  com escapes; apóstrofo dentro de aspas duplas (ou crase) não corta as etiquetas.
  Roda: node --test src/lib/ci/e974-etiquetas-com-apostrofo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetasDoSpec } from "./prova-ao-vivo.ts";

test("E974 — apóstrofo dentro de aspas duplas não esconde as etiquetas", () => {
  const fonte = `test.describe("T2052 — conta d'água e nota @E631 @ao-vivo-seguro", () => {});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E631", "@ao-vivo-seguro"]);
});

test("E974 — o mesmo em crase e com aspa simples escapada", () => {
  assert.deepEqual(etiquetasDoSpec("test(`d'água @E700 @ao-vivo-seguro`, async () => {});"), ["@E700", "@ao-vivo-seguro"]);
  assert.deepEqual(etiquetasDoSpec("test('d\\'água @E701', async () => {});"), ["@E701"]);
});

test("E974 — aspas duplas dentro de aspas simples também não cortam; o que já funcionava continua", () => {
  assert.deepEqual(etiquetasDoSpec(`test('o "Salvo" aparece @E702', () => {});`), ["@E702"]);
  assert.deepEqual(etiquetasDoSpec(`test.describe("T1 @E1 @criticos", () => { test("x @E2", () => {}); });`), ["@E1", "@E2", "@criticos"]);
  assert.deepEqual(etiquetasDoSpec(`test("x", { tag: ["@E3", "@ao-vivo-seguro"] }, () => {});`), ["@E3", "@ao-vivo-seguro"]);
});

test("E974 alargado (02:55Z) — aspas também não cortam: aspa dupla escapada, aspas misturadas em crase e no tag:", () => {
  // Aspas duplas escapadas dentro de aspas duplas.
  assert.deepEqual(etiquetasDoSpec(`test("o \\"Salvo\\" aparece @E703 @ao-vivo-seguro", () => {});`), ["@E703", "@ao-vivo-seguro"]);
  // Crase com aspas duplas E apóstrofo.
  assert.deepEqual(etiquetasDoSpec('test(`d\'água e o "Salvo" @E704`, () => {});'), ["@E704"]);
  // describe + test com aspas e apóstrofos, cada um com as suas etiquetas.
  assert.deepEqual(
    etiquetasDoSpec(`test.describe('T9 — o "Pedido" @E705', () => { test("d'água @E706", () => {}); });`),
    ["@E705", "@E706"],
  );
  // tag: string com apóstrofo dentro de aspas duplas e lista com aspas simples.
  assert.deepEqual(etiquetasDoSpec(`test("x", { tag: "@E707" }, () => {}); test('y', { tag: ['@E708', "@ao-vivo-seguro"] }, () => {});`), ["@E707", "@E708", "@ao-vivo-seguro"]);
});
