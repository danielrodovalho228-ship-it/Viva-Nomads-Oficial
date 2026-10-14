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

// O seed do lab (scripts/lab/totp.mjs) cria o fator da admin com o MESMO algoritmo da suíte E2E.
test("seed do lab gera os mesmos códigos que a fixture da suíte E2E", async () => {
  const seed = await import("../../scripts/lab/totp.mjs");
  for (const t of [59_000, 1_111_111_109_000, 1_234_567_890_000, Date.now()]) {
    assert.equal(seed.gerarCodigoTotp(SEGREDO, t), gerarCodigoTotp(SEGREDO, t));
  }
  assert.throws(() => seed.gerarCodigoTotp("não é base32!", 59_000));
});

test("ativarTotp: inscreve, verifica com o código certo e devolve o segredo", async () => {
  const seed = await import("../../scripts/lab/totp.mjs");
  const chamadas: string[] = [];
  const cliente = {
    auth: {
      signInWithPassword: async () => (chamadas.push("login"), { error: null }),
      mfa: {
        enroll: async () => (chamadas.push("enroll"), { data: { id: "f1", totp: { secret: SEGREDO } }, error: null }),
        challenge: async () => (chamadas.push("challenge"), { data: { id: "c1" }, error: null }),
        verify: async (a: { factorId: string; challengeId: string; code: string }) => {
          chamadas.push("verify");
          assert.equal(a.factorId, "f1");
          assert.equal(a.challengeId, "c1");
          assert.match(a.code, /^\d{6}$/);
          return { error: null };
        },
      },
    },
  };
  assert.equal(await seed.ativarTotp(cliente, "a@b.test", "x"), SEGREDO);
  assert.deepEqual(chamadas, ["login", "enroll", "challenge", "verify"]);
  const ruim = { auth: { signInWithPassword: async () => ({ error: { message: "nope" } }) } };
  await assert.rejects(() => seed.ativarTotp(ruim, "a@b.test", "x"), /login/);
});
