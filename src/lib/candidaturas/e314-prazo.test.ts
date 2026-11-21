import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXIMO_PASSO_CANDIDATURA } from "./status.ts";

test("E314 (devolução): o cartão 'Em análise' traz o prazo oficial 'em até 1 dia útil'", () => {
  const p = PROXIMO_PASSO_CANDIDATURA.em_analise!;
  assert.match(p.agora, /^O proprietário já viu a sua candidatura e está avaliando\./);
  assert.match(p.agora, /em até 1 dia útil/);
});

test("E314 → E395: o prazo aparece desde o envio — o 'Enviada' também diz 'em até 1 dia útil'", () => {
  assert.match(PROXIMO_PASSO_CANDIDATURA.enviada!.agora, /em até 1 dia útil/);
});
