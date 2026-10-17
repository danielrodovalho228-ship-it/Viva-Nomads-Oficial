import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guarda (lab f5cf6290): o 2º teste do t61 era pulado ("conta já com 2FA"); ele precisa de conta própria e não pode pular.
const spec = readFileSync("tests/e2e/specs/t61-2fa-codigos-recuperacao.spec.ts", "utf8");

test("t61: o teste do alerta do código do app usa conta própria e não é pulado", () => {
  const bloco = spec.slice(spec.indexOf("mensagem de erro do código do app"));
  assert.match(bloco, /entrar\(browser, dono2\.email/);
  assert.doesNotMatch(bloco, /test\.skip\(/);
  assert.match(spec, /apagarContas\(\[donoId, dono2Id\]\)/);
});
