import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/** Ordem fe7ac2e7 (F10): 404/queda transitória no painel precisa oferecer "Tentar de novo". */
const arquivo = new URL("./error.tsx", import.meta.url);

test("o painel tem error.tsx de cliente com Tentar de novo e saída para o painel", () => {
  assert.ok(existsSync(arquivo));
  const fonte = readFileSync(arquivo, "utf8");
  assert.match(fonte, /^"use client";/);
  // Next 16: o botão chama unstable_retry (busca e renderiza de novo), com reset como alternativa; a prop antiga `retry` não existe.
  assert.match(fonte, /unstable_retry/);
  assert.match(fonte, /reset/);
  assert.doesNotMatch(fonte, /\bretry\(\)/);
  assert.match(fonte, /Tentar de novo/);
  assert.match(fonte, /href="\/dashboard"/);
  assert.match(fonte, /role="alert"/);
});

test("a mensagem não vaza detalhes internos do erro", () => {
  const fonte = readFileSync(arquivo, "utf8");
  assert.doesNotMatch(fonte, /error\.(message|stack|digest)/);
});
