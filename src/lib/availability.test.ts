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
  diasEntre,
  addDias,
  validarReserva,
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

// 11) diasEntre e addDias
test("11: diasEntre / addDias", () => {
  assert.equal(diasEntre("2026-08-01", "2026-08-31"), 30);
  assert.equal(diasEntre("2026-08-10", "2026-08-05"), -5);
  assert.equal(addDias("2026-08-01", 30), "2026-08-31");
  assert.equal(addDias("2026-08-31", 1), "2026-09-01");
});

const BASE = { fromISO: "2026-08-01", untilISO: "2027-02-01", minDias: 30, maxDias: 180 };

// 12) reserva válida no meio da janela
test("12: reserva válida", () => {
  const r = validarReserva({ ...BASE, checkIn: "2026-09-01", checkOut: "2026-10-01" });
  assert.equal(r.ok, true);
  assert.equal(r.dias, 30);
});

// 13) saída antes/igual à entrada → inválida
test("13: saída <= entrada", () => {
  assert.equal(validarReserva({ ...BASE, checkIn: "2026-09-10", checkOut: "2026-09-10" }).ok, false);
});

// 14) entrada antes do início da disponibilidade
test("14: antes do início", () => {
  const r = validarReserva({ ...BASE, checkIn: "2026-07-15", checkOut: "2026-08-20" });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /início/i);
});

// 15) saída depois do fim da disponibilidade
test("15: passa do fim", () => {
  const r = validarReserva({ ...BASE, checkIn: "2027-01-15", checkOut: "2027-03-01" });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /fim/i);
});

// 16) abaixo da estadia mínima
test("16: abaixo do mínimo", () => {
  const r = validarReserva({ ...BASE, checkIn: "2026-09-01", checkOut: "2026-09-10" });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /mínima/i);
});

// 17) acima da estadia máxima
test("17: acima do máximo", () => {
  const r = validarReserva({ ...BASE, checkIn: "2026-08-01", checkOut: "2027-02-01", maxDias: 90 });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /máxima/i);
});

// 18) período com dia bloqueado pelo proprietário
test("18: dia bloqueado no período", () => {
  const r = validarReserva({
    ...BASE,
    checkIn: "2026-09-01",
    checkOut: "2026-10-05",
    bloqueados: ["2026-09-20"],
  });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /indisponíve/i);
});

// 19) bloqueio FORA do período não invalida
test("19: bloqueio fora do período não afeta", () => {
  const r = validarReserva({
    ...BASE,
    checkIn: "2026-09-01",
    checkOut: "2026-10-01",
    bloqueados: ["2026-11-15"],
  });
  assert.equal(r.ok, true);
});

// 20) janela aberta (sem until): reserva longa ainda ok se dentro do máximo
test("20: janela aberta respeita só o máximo", () => {
  const r = validarReserva({ fromISO: "2026-08-01", checkIn: "2026-09-01", checkOut: "2026-11-01", minDias: 30, maxDias: 180 });
  assert.equal(r.ok, true);
});
