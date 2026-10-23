import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/** Ordem fe7ac2e7 (F10): 404/queda transitória no painel precisa oferecer "Tentar de novo". */
const arquivo = new URL("./error.tsx", import.meta.url);

test("o painel tem error.tsx de cliente com Tentar de novo e saída para o painel", () => {
  assert.ok(existsSync(arquivo));
  const fonte = readFileSync(arquivo, "utf8");
  assert.match(fonte, /^"use client";/);
  assert.match(fonte, /retry\(\)/);
  assert.match(fonte, /Tentar de novo/);
  assert.match(fonte, /href="\/dashboard"/);
  assert.match(fonte, /role="alert"/);
});

test("a mensagem não vaza detalhes internos do erro", () => {
  const fonte = readFileSync(arquivo, "utf8");
  assert.doesNotMatch(fonte, /error\.(message|stack|digest)/);
});
