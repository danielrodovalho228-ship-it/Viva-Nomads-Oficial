import test from "node:test";
import assert from "node:assert/strict";
import { gerarCodigoTotp } from "../e2e/fixtures/totp.ts";

// Vetores do RFC 6238 (segredo ASCII "12345678901234567890" em base32), 6 últimos dígitos dos 8 do RFC.
const SEGREDO = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP bate com os vetores do RFC 6238", () => {
  assert.equal(gerarCodigoTotp(SEGREDO, 59_000), "287082");
  assert.equal(gerarCodigoTotp(SEGREDO, 1_111_111_109_000), "081804");
  assert.equal(gerarCodigoTotp(SEGREDO, 1_234_567_890_000), "005924");
});

test("segredo com espaços/minúsculas funciona; segredo inválido falha", () => {
  assert.equal(gerarCodigoTotp("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000), "287082");
  assert.throws(() => gerarCodigoTotp("não é base32!", 59_000));
});
