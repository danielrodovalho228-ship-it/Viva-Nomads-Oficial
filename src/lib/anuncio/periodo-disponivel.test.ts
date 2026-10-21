import test from "node:test";
import assert from "node:assert/strict";
import { periodoDisponivelValido } from "./periodo-disponivel.ts";

test("até antes de a partir de é recusado", () => {
  assert.equal(periodoDisponivelValido("2026-11-10", "2026-11-01"), false);
});
test("até igual ou depois é aceito", () => {
  assert.equal(periodoDisponivelValido("2026-11-10", "2026-11-10"), true);
  assert.equal(periodoDisponivelValido("2026-11-10", "2027-01-01"), true);
});
test("campo vazio não bloqueia", () => {
  assert.equal(periodoDisponivelValido("", "2026-11-01"), true);
  assert.equal(periodoDisponivelValido("2026-11-10", undefined), true);
});
