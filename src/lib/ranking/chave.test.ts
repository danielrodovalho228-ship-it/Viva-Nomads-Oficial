import { test } from "node:test";
import assert from "node:assert/strict";
import { gravarSombra, ordemNovaLigada, sementeDoDia } from "./chave.ts";

test("chave: desligada por padrão; o interruptor do admin prevalece sobre o ambiente", () => {
  assert.equal(ordemNovaLigada(undefined, null), false);
  assert.equal(ordemNovaLigada("off", null), false);
  assert.equal(ordemNovaLigada("on", null), true);
  assert.equal(ordemNovaLigada("on", false), false, "desligar no admin vence o ambiente");
  assert.equal(ordemNovaLigada(undefined, true), true);
});

test("semente do dia segue a data de São Paulo, não a de UTC", () => {
  assert.equal(sementeDoDia(new Date("2026-11-01T12:00:00Z")), 20261101);
  // 01:30 UTC do dia 2 ainda é dia 1 em Brasília (UTC−3).
  assert.equal(sementeDoDia(new Date("2026-11-02T01:30:00Z")), 20261101);
  assert.equal(sementeDoDia(new Date("2026-11-02T03:00:00Z")), 20261102);
});

test("sombra grava 1 em cada 5", () => {
  const grava = Array.from({ length: 1000 }, (_, i) => gravarSombra(i / 1000)).filter(Boolean).length;
  assert.equal(grava, 200);
});
