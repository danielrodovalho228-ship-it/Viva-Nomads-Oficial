/*
  Datas no formato brasileiro.
  Roda: node --test src/lib/utils.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataBR, hojeBR } from "./utils.ts";

test("dataBR: só data não muda de dia; timestamp vira o dia de Brasília", () => {
  assert.equal(dataBR("2026-07-10"), "10/07/2026");
  // 00:30 UTC = 21:30 do dia 09 em Brasília (antes mostrava 10, o dia em UTC).
  assert.equal(dataBR("2026-07-10T00:30:00+00:00"), "09/07/2026");
  assert.equal(dataBR("2026-07-10T15:00:00+00:00"), "10/07/2026");
  assert.equal(dataBR(null), "—");
  assert.equal(dataBR("ontem"), "—");
});

test("numBR usa vírgula decimal e trata valores inválidos", async () => {
  const { numBR } = await import("./utils.ts");
  assert.equal(numBR(18.4123, 2), "18,41");
  assert.equal(numBR(4.8), "4,8");
  assert.equal(numBR(1234.5, 1), "1.234,5");
  assert.equal(numBR(Infinity), "—");
});

test("hojeBR: às 22h de Brasília ainda é hoje (em UTC já seria amanhã)", () => {
  assert.equal(hojeBR(new Date("2026-10-05T01:00:00Z")), "2026-10-04");
  assert.equal(hojeBR(new Date("2026-10-05T03:00:00Z")), "2026-10-05");
});
