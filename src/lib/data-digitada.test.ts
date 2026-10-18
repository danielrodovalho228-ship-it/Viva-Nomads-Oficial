import { test } from "node:test";
import assert from "node:assert/strict";
import { brParaIso, interpretarDataColada, isoParaBr, mascararData } from "./data-digitada.ts";

test("p22 — máscara dd/mm/aaaa ao digitar", () => {
  assert.equal(mascararData("0"), "0");
  assert.equal(mascararData("011"), "01/1");
  assert.equal(mascararData("01112026"), "01/11/2026");
  assert.equal(mascararData("01/11/2026 extra 9"), "01/11/2026");
});

test("p22 — dd/mm/aaaa ↔ ISO; data inexistente ou incompleta não vale", () => {
  assert.equal(brParaIso("01/11/2026"), "2026-11-01");
  assert.equal(brParaIso("31/02/2027"), null);
  assert.equal(brParaIso("01/11/20"), null);
  assert.equal(isoParaBr("2026-11-01"), "01/11/2026");
  assert.equal(isoParaBr(""), "");
});

test("p22 — colar em vários formatos", () => {
  for (const [colado, iso] of [
    ["01/11/2026", "2026-11-01"],
    ["1/11/2026", "2026-11-01"],
    ["01-11-2026", "2026-11-01"],
    ["01.11.2026", "2026-11-01"],
    ["01/11/26", "2026-11-01"],
    ["2026-11-01", "2026-11-01"],
    ["2026-11-01T10:00:00Z", "2026-11-01"],
    ["01112026", "2026-11-01"],
    [" 01/11/2026 ", "2026-11-01"],
  ] as const) {
    assert.equal(interpretarDataColada(colado), iso, colado);
  }
  assert.equal(interpretarDataColada("amanhã"), null);
  assert.equal(interpretarDataColada("30/02/2026"), null);
});
