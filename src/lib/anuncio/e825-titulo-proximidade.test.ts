/*
  E825 — o título não afirma proximidade que o corpo do anúncio desmente.
  Roda: node --test src/lib/anuncio/e825-titulo-proximidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { lugaresDoAnuncio, proximidadeDivergente } from "./titulo-proximidade.ts";

const ube004 = SAMPLE_PROPERTIES.find((p) => p.id === "ube-004")!;

test("o título antigo do ube-004 é pego pela régua (HC-UFU a 1,7 km não é 'ao lado')", () => {
  const d = proximidadeDivergente("Studio ao lado do Hospital de Clínicas (UFU)", lugaresDoAnuncio(ube004));
  assert.deepEqual(d, { afirmacao: "ao lado do Hospital de Clínicas (UFU)", lugar: "Hospital de Clínicas — UFU", distanciaM: 1680, limiteM: 300 });
});

test("varredura: nenhum título de exemplo afirma distância/proximidade que o corpo não sustenta", () => {
  for (const p of SAMPLE_PROPERTIES) assert.equal(proximidadeDivergente(p.title, lugaresDoAnuncio(p)), null, `${p.id}: ${p.title}`);
  assert.equal(ube004.title, "Studio perto do campus Umuarama (UFU), a 1,7 km do Hospital de Clínicas");
});

test("a régua: ao lado ≤ 300 m, perto ≤ 1 km, distância explícita bate com o corpo, sem lugar no corpo = sem lastro", () => {
  const L = [{ nome: "Hospital Municipal", distanciaM: 250 }, { nome: "Campus da UFU", distanciaM: 900 }];
  assert.equal(proximidadeDivergente("Studio ao lado do Hospital Municipal", L), null);
  assert.ok(proximidadeDivergente("Studio ao lado da UFU", L), "900 m não é 'ao lado'");
  assert.equal(proximidadeDivergente("Studio perto da UFU", L), null);
  assert.equal(proximidadeDivergente("Studio a 0,9 km da UFU", L), null);
  assert.ok(proximidadeDivergente("Studio a 3 km da UFU", L), "a distância dita não bate com o corpo");
  assert.deepEqual(proximidadeDivergente("Studio perto do Shopping", L)?.lugar, null, "afirmação sem lugar no corpo");
  assert.equal(proximidadeDivergente("Studio no Centro", L), null);
});
