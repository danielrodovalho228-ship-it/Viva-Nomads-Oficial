import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehGravacaoDeLead } from "../e2e/fixtures/gravacao-lead.ts";

test("POST de Server Action de leitura não conta como gravação; candidatura e mensagem contam", () => {
  assert.equal(ehGravacaoDeLead("POST", '["ube-001"]'), false);
  assert.equal(ehGravacaoDeLead("POST", "[]"), false);
  assert.equal(ehGravacaoDeLead("GET", '["ube-001","Studio","candidatura"]'), false);
  assert.equal(ehGravacaoDeLead("POST", '["ube-001","Studio","candidatura",null]'), true);
  assert.equal(ehGravacaoDeLead("POST", '["ube-001","Studio","duvida","oi"]'), true);
  assert.equal(ehGravacaoDeLead("POST", '["x","Posso entrar em dezembro?"]', ["Posso entrar em dezembro?"]), true);
  assert.equal(ehGravacaoDeLead("POST", null), false);
});

test("t130 usa o filtro de gravação em vez de contar todo POST", () => {
  const spec = readFileSync("tests/e2e/specs/t130-reserva-imovel.spec.ts", "utf8");
  assert.match(spec, /ehGravacaoDeLead/);
  assert.doesNotMatch(spec, /r\.method\(\) === "POST"\) gravacoes/);
});
