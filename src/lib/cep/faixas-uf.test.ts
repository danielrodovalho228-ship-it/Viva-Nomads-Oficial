import { test } from "node:test";
import assert from "node:assert/strict";
import { ufBateComCep, ufDaFaixa } from "./faixas-uf.ts";

test("p25 — faixas de CEP por UF (Correios)", () => {
  assert.equal(ufDaFaixa("99999999"), "RS");
  assert.equal(ufDaFaixa("38408000"), "MG");
  assert.equal(ufDaFaixa("01310100"), "SP");
  assert.equal(ufDaFaixa("70040010"), "DF");
  assert.equal(ufDaFaixa("74000000"), "GO");
  assert.equal(ufDaFaixa("69301000"), "RR");
  assert.equal(ufDaFaixa("69900000"), "AC");
  assert.equal(ufDaFaixa("00999999"), null);
  assert.equal(ufBateComCep("99999999", "PR"), false);
  assert.equal(ufBateComCep("87000000", "pr"), true);
});
