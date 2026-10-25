/*
  A4 — data de nascimento (mockup perfil-04): máscara, conversão e validação.
  Roda: node --test src/lib/conta/nascimento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mascararNascimento, nascimentoParaTela, validarNascimento } from "./nascimento.ts";

const HOJE = new Date(2026, 9, 24);

test("máscara dd/mm/aaaa enquanto digita", () => {
  assert.equal(mascararNascimento("1"), "1");
  assert.equal(mascararNascimento("1403"), "14/03");
  assert.equal(mascararNascimento("14031991"), "14/03/1991");
  assert.equal(mascararNascimento("14/03/1991999"), "14/03/1991");
});

test("ida e volta entre a tela e o banco", () => {
  assert.deepEqual(validarNascimento("14/03/1991", HOJE), { ok: true, iso: "1991-03-14" });
  assert.equal(nascimentoParaTela("1991-03-14"), "14/03/1991");
  assert.equal(nascimentoParaTela(null), "");
  assert.deepEqual(validarNascimento("  ", HOJE), { ok: true, iso: null });
});

test("recusa data que não existe, no futuro ou antes de 1900", () => {
  for (const v of ["31/02/1991", "14/13/1991", "25/10/2026", "01/01/1899", "1991-03-14", "14/3/1991"]) assert.equal(validarNascimento(v, HOJE).ok, false, v);
  assert.equal(validarNascimento("24/10/2026", HOJE).ok, true);
});

test("sem regra de idade inventada", () => {
  const fonte = readFileSync(new URL("./nascimento.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /18 anos|maior de idade|idade m[ií]nima/i);
});
