import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXIMO_PASSO_CANDIDATURA } from "./status.ts";

test("E314 (devolução): o cartão 'Em análise' traz o prazo oficial 'em até 1 dia útil'", () => {
  const p = PROXIMO_PASSO_CANDIDATURA.em_analise!;
  assert.match(p.agora, /^O proprietário já viu a sua candidatura e está avaliando\./);
  assert.match(p.agora, /em até 1 dia útil/);
});

// Asserção alterada (E395, regra do coordenador): o prazo do proprietário aparece DESDE O ENVIO — o "Enviada" agora diz
// "em até 1 dia útil" (antes este teste exigia o contrário). Trava da Pista 3: e395-t2048-prazo-no-envio.test.ts.
test("E314/E395: o 'Enviada' também traz o prazo oficial, desde o envio", () => {
  assert.match(JSON.stringify(PROXIMO_PASSO_CANDIDATURA.enviada), /em até 1 dia útil/);
});
