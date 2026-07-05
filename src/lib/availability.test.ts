/*
  Testes das regras de disponibilidade (calendário do imóvel).
  Roda: node --experimental-strip-types --test src/lib/availability.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  diaDisponivel,
  inicioEfetivo,
  mesesCalendario,
  estadiaLabel,
} from "./availability.ts";

// 1) dia dentro da janela → disponível
test("1: dia dentro da janela", () => {
  assert.equal(diaDisponivel("2026-08-15", "2026-08-01", "2026-08-31"), true);
});

// 2) borda inicial (== from) → disponível
test("2: borda inicial inclusa", () => {
  assert.equal(diaDisponivel("2026-08-01", "2026-08-01", "2026-08-31"), true);
});

// 3) borda final (== until) → disponível
test("3: borda final inclusa", () => {
  assert.equal(diaDisponivel("2026-08-31", "2026-08-01", "2026-08-31"), true);
});

// 4) dia antes do início → indisponível
test("4: antes do início", () => {
  assert.equal(diaDisponivel("2026-07-31", "2026-08-01", "2026-08-31"), false);
});

// 5) dia depois do fim → indisponível
test("5: depois do fim", () => {
  assert.equal(diaDisponivel("2026-09-01", "2026-08-01", "2026-08-31"), false);
});

// 6) janela ABERTA (sem until): depois do início → disponível
test("6: janela aberta, depois do início", () => {
  assert.equal(diaDisponivel("2027-01-01", "2026-08-01"), true);
});

// 7) janela aberta: muito no futuro ainda disponível
test("7: janela aberta, futuro distante", () => {
  assert.equal(diaDisponivel("2030-12-31", "2026-08-01", null), true);
});

// 8) início efetivo cai em "hoje" quando o anúncio não tem data
test("8: inicioEfetivo usa hoje sem data", () => {
  assert.equal(inicioEfetivo(null, "2026-07-05"), "2026-07-05");
  assert.equal(inicioEfetivo("2026-08-01", "2026-07-05"), "2026-08-01");
});

// 9) meses do calendário atravessam a virada de ano
test("9: mesesCalendario vira o ano", () => {
  assert.deepEqual(mesesCalendario("2026-11-10", 3), [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
    { year: 2027, month: 0 },
  ]);
});

// 10) rótulo de estadia com e sem valores
test("10: estadiaLabel padrão e custom", () => {
  assert.equal(estadiaLabel(30, 180), "30 a 180 dias");
  assert.equal(estadiaLabel(null, null), "30 a 180 dias");
  assert.equal(estadiaLabel(60, 90), "60 a 90 dias");
});
