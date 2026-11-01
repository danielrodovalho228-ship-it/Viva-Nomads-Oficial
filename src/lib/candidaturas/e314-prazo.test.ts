import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXIMO_PASSO_CANDIDATURA } from "./status.ts";

test("E314 (devolução): o cartão 'Em análise' traz o prazo oficial 'em até 1 dia útil'", () => {
  const p = PROXIMO_PASSO_CANDIDATURA.em_analise!;
  assert.match(p.agora, /^O proprietário já viu a sua candidatura e está avaliando\./);
  assert.match(p.agora, /em até 1 dia útil/);
});

test("E314: só o 'Em análise' muda — o 'Enviada' segue sem prazo", () => {
  assert.doesNotMatch(JSON.stringify(PROXIMO_PASSO_CANDIDATURA.enviada), /dia útil/);
});
