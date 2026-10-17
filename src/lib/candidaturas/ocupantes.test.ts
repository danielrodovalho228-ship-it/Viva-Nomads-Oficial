/*
  Quantas pessoas vão morar (prompt 8). Roda: node --test src/lib/candidaturas/ocupantes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ocupantesIniciais, rotuloOcupantes, validarOcupantes } from "./ocupantes.ts";

test("vazio é opcional; 1 a 20 e até a capacidade", () => {
  assert.deepEqual(validarOcupantes(undefined, 4), { ok: true, valor: null });
  assert.deepEqual(validarOcupantes(3, 4), { ok: true, valor: 3 });
  assert.deepEqual(validarOcupantes(5, 4), { ok: false, erro: "Este imóvel recebe até 4 pessoas." });
  assert.deepEqual(validarOcupantes(2, 1), { ok: false, erro: "Este imóvel recebe até 1 pessoa." });
  assert.equal(validarOcupantes(0, null).ok, false);
  assert.equal(validarOcupantes(2.5, null).ok, false);
  assert.equal(validarOcupantes(21, null).ok, false);
  assert.deepEqual(validarOcupantes(6, null), { ok: true, valor: 6 });
});

test("rótulo e valor inicial do Fechamento", () => {
  assert.equal(rotuloOcupantes(1), "1 pessoa");
  assert.equal(rotuloOcupantes(3), "3 pessoas");
  assert.equal(ocupantesIniciais(3, 4), 3);
  assert.equal(ocupantesIniciais(null, 4), 1);
  assert.equal(ocupantesIniciais(6, 4), 4);
});
