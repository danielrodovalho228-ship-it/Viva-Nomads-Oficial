import test from "node:test";
import assert from "node:assert/strict";
import { sessaoAdminOciosa, LIMITE_OCIOSO_ADMIN_MS } from "./sessao-ociosa.ts";

const agora = 1_800_000_000_000;

test("30 min exatos ainda vale; passou de 30 min expira", () => {
  assert.equal(sessaoAdminOciosa(agora - LIMITE_OCIOSO_ADMIN_MS, agora), false);
  assert.equal(sessaoAdminOciosa(agora - LIMITE_OCIOSO_ADMIN_MS - 1, agora), true);
});

test("atividade recente não expira (aceita string do cookie)", () => {
  assert.equal(sessaoAdminOciosa(String(agora - 60_000), agora), false);
});

test("cookie ausente, vazio ou inválido = sessão nova, não expira", () => {
  for (const v of [undefined, null, "", "abc", "0", "-5"]) {
    assert.equal(sessaoAdminOciosa(v, agora), false, String(v));
  }
});
