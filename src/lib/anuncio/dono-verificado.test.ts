import test from "node:test";
import assert from "node:assert/strict";
import { donoVerificado, EXPLICACAO_DONO_VERIFICADO } from "./dono-verificado.ts";
import { readFileSync } from "node:fs";

const real = (verified?: boolean) => ({ id: "ddf86c66-a214-463d-8563-66a5204010b5", owner: { name: "Ana", verified } });

test("verificação real registrada mostra o selo", () => {
  assert.equal(donoVerificado(real(true)), true);
});

test("sem verificação (false, ausente, sem dono) não mostra o selo", () => {
  assert.equal(donoVerificado(real(false)), false);
  assert.equal(donoVerificado(real(undefined)), false);
  assert.equal(donoVerificado({ id: "x", owner: undefined }), false);
  assert.equal(donoVerificado(null), false);
});

test("anúncio de exemplo nunca ostenta o selo, nem com verified=true", () => {
  assert.equal(donoVerificado({ id: "ube-001", owner: { name: "Exemplo", verified: true } }), false);
});

test("dados de exemplo (properties.ts) não trazem owner.verified=true", () => {
  const src = readFileSync(new URL("../properties.ts", import.meta.url), "utf8");
  assert.ok(/owner: \{/.test(src));
  assert.doesNotMatch(src, /owner: \{[^}]*verified: true/);
});

test("explicação curta, sem 'propriedade verificada' nem 'vistoria'", () => {
  assert.ok(EXPLICACAO_DONO_VERIFICADO.length < 200);
  assert.doesNotMatch(EXPLICACAO_DONO_VERIFICADO, /propriedade verificada|vistoria/i);
});
