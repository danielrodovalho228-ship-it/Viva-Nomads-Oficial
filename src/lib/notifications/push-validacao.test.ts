import test from "node:test";
import assert from "node:assert/strict";
import { plataformaValida, podeEnviarTeste, tokenValido } from "./push-validacao.ts";

test("tokenValido: aceita Expo e nativo; recusa lixo", () => {
  assert.equal(tokenValido("ExponentPushToken[abc123-xyz]"), true);
  assert.equal(tokenValido("dGVzdC10b2tlbjoxMjM0NTY3ODkw"), true);
  for (const ruim of ["", "curto", "Expo[abc]", "ExponentPushToken[]", "com espaço no meio", "x".repeat(5000), "<script>alert(1)</script>", 123, null, undefined]) {
    assert.equal(tokenValido(ruim), false, String(ruim));
  }
});

test("plataformaValida: só android/ios/web", () => {
  assert.equal(plataformaValida("ios"), true);
  assert.equal(plataformaValida("windows"), false);
  assert.equal(plataformaValida(undefined), false);
});

test("podeEnviarTeste: 5 por hora por admin, depois libera", () => {
  const h = new Map<string, number[]>();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(podeEnviarTeste(h, "a", t0 + i), true);
  assert.equal(podeEnviarTeste(h, "a", t0 + 10), false);
  assert.equal(podeEnviarTeste(h, "b", t0 + 10), true);
  assert.equal(podeEnviarTeste(h, "a", t0 + 3_600_001), true);
});
