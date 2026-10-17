import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Achado do Moacir (ordem a7881041): a recusa do código de assinatura não pode depender de contrato
// já existente na conta de teste; o t57 precisa semear o próprio contrato e provar as duas partes.
const spec = readFileSync("tests/e2e/specs/t57-contrato-assinar.spec.ts", "utf8");

test("t57 semeia contrato e dono/inquilino próprios no laboratório", () => {
  assert.match(spec, /from\("contratos"\)\s*\.insert/);
  assert.match(spec, /criarConta\(dono/);
  assert.match(spec, /criarConta\(inq/);
});

test("t57 prova a recusa do código nas duas partes, sem pular", () => {
  const bloco = spec.slice(spec.indexOf("Contrato semeado"));
  assert.match(bloco, /inquilino: título abre o contrato e o código que não foi pedido é recusado/);
  assert.match(bloco, /proprietário: 'Ver e assinar contrato'.*recusado/);
  assert.doesNotMatch(bloco, /test\.skip\([^)]*count\(\)/);
});
