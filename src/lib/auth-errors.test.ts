import test from "node:test";
import assert from "node:assert/strict";
import { friendlyAuthError } from "./auth-errors.ts";

const MSG = "Não conseguimos usar este e-mail. Confira se está digitado certo ou use outro endereço.";

test("e-mail recusado pelo Supabase vira mensagem clara (F2)", () => {
  for (const raw of [
    'Email address "fulano@dominio-sem-mx.xyz" is invalid',
    "email_address_invalid",
    "Email domain not allowed",
  ]) {
    assert.equal(friendlyAuthError(raw), MSG, raw);
  }
});

test("mensagens antigas continuam iguais", () => {
  assert.equal(friendlyAuthError("Unable to validate email address: invalid format"), "Digite um e-mail válido.");
  assert.equal(friendlyAuthError("algo inesperado raro"), "Não foi possível concluir. Tente novamente.");
});
