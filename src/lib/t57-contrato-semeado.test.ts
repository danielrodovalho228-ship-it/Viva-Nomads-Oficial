import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Ordem 22a310d2 (achado do Moacir): o t57 não pode pular por "conta sem contrato semeado";
// o próprio teste cria o contrato no laboratório.
const spec = readFileSync(join(process.cwd(), "tests", "e2e", "specs", "t57-contrato-assinar.spec.ts"), "utf8");

test("t57 não pula por falta de contrato: semeia o seu", () => {
  assert.doesNotMatch(spec, /sem contrato semeado/);
  assert.match(spec, /from\("contratos"\)\s*\.insert\(/);
  assert.match(spec, /apagarContas\(/);
});

test("t57 confere a recusa do código e que nada foi assinado", () => {
  assert.match(spec, /assinado_inquilino_em/);
  assert.match(spec, /assinar-codigo/);
});
