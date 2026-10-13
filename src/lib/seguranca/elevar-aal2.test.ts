import test from "node:test";
import assert from "node:assert/strict";
import { elevarParaAal2, type ClienteMfa } from "./elevar-aal2.ts";

function cliente(nivel: [string, string], verifica: { error: { message: string } | null } = { error: null }) {
  const chamadas: string[] = [];
  const c: ClienteMfa = {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: nivel[0], nextLevel: nivel[1] } }),
        listFactors: async () => ({ data: { totp: [{ id: "f1" }] } }),
        challengeAndVerify: async (a) => {
          chamadas.push(`${a.factorId}:${a.code}`);
          return verifica;
        },
      },
    },
  };
  return { c, chamadas };
}

test("sem 2FA (aal1/aal1) ou já aal2: segue direto, sem pedir código", async () => {
  assert.deepEqual(await elevarParaAal2(cliente(["aal1", "aal1"]).c, ""), { ok: true });
  assert.deepEqual(await elevarParaAal2(cliente(["aal2", "aal2"]).c, ""), { ok: true });
});

test("2FA ativo e sessão aal1 sem código digitado: pede o código (nunca o erro genérico)", async () => {
  const { c, chamadas } = cliente(["aal1", "aal2"]);
  const r = await elevarParaAal2(c, "");
  assert.deepEqual(r, { ok: false, pedirCodigo: true, erro: "Confirme o código do seu autenticador para alterar a senha." });
  assert.equal(chamadas.length, 0);
});

test("2FA ativo, aal1 e código correto: verifica no fator e libera", async () => {
  const { c, chamadas } = cliente(["aal1", "aal2"]);
  assert.deepEqual(await elevarParaAal2(c, "123 456"), { ok: true });
  assert.deepEqual(chamadas, ["f1:123456"]);
});

test("código errado: não libera e orienta sobre o horário do celular", async () => {
  const { c } = cliente(["aal1", "aal2"], { error: { message: "Invalid TOTP code entered" } });
  const r = await elevarParaAal2(c, "000000");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /relógio do celular está no automático/);
});

test("código com formato inválido não chega ao Supabase", async () => {
  const { c, chamadas } = cliente(["aal1", "aal2"]);
  const r = await elevarParaAal2(c, "12ab");
  assert.equal(r.ok, false);
  assert.equal(chamadas.length, 0);
});
