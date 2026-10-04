/*
  Piloto Fundador.
  Roda: node --test src/lib/fundador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { planoEfetivo, fundadorNoGratis, precoComDescontoFundador, fimGratisFundador } from "./fundador.ts";

const agora = new Date("2026-10-04T12:00:00Z");

test("Fundador nos 12 meses: vale Profissional sem assinatura (antes: Gratuito, 12%)", () => {
  assert.equal(planoEfetivo(null, true, "2026-05-01T00:00:00Z", agora), "pro");
  assert.equal(planoEfetivo("free", true, "2026-05-01T00:00:00Z", agora), "pro");
});

test("Depois dos 12 meses, sem assinatura: Gratuito", () => {
  assert.equal(planoEfetivo(null, true, "2025-09-01T00:00:00Z", agora), "free");
  assert.equal(fundadorNoGratis(true, "2025-09-01T00:00:00Z", agora), false);
});

test("Assinatura ativa sempre vale; não-fundador sem assinatura é Gratuito", () => {
  assert.equal(planoEfetivo("essential", true, "2026-05-01T00:00:00Z", agora), "essential");
  assert.equal(planoEfetivo(null, false, null, agora), "free");
  assert.equal(planoEfetivo(null, true, null, agora), "free"); // sem data = não marcado direito
});

test("20% de desconto vitalício na assinatura", () => {
  assert.equal(precoComDescontoFundador(129, true), 103.2);
  assert.equal(precoComDescontoFundador(49, true), 39.2);
  assert.equal(precoComDescontoFundador(129, false), 129);
  assert.equal(fimGratisFundador(true, "2026-01-15T00:00:00Z"), "2027-01-15T00:00:00.000Z");
});
