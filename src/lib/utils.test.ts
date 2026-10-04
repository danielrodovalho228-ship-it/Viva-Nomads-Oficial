/*
  Datas no formato brasileiro.
  Roda: node --test src/lib/utils.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataBR } from "./utils.ts";

test("dataBR formata AAAA-MM-DD e ISO sem mudar o dia por fuso", () => {
  assert.equal(dataBR("2026-07-10"), "10/07/2026");
  assert.equal(dataBR("2026-07-10T00:30:00+00:00"), "10/07/2026");
  assert.equal(dataBR(null), "—");
  assert.equal(dataBR("ontem"), "—");
});
