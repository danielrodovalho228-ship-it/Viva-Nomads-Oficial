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
