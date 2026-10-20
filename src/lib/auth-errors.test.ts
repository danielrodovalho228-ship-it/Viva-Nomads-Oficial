import test from "node:test";
import assert from "node:assert/strict";
import { cadastroDuplicadoOfuscado, friendlyAuthError, MSG_CADASTRO_NEUTRO } from "./auth-errors.ts";

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

test("insufficient_aal (2FA ativo, sessão só com senha) pede o código, nunca o genérico", () => {
  const msg = "AAL2 session is required to update email or password when MFA is enabled.";
  assert.equal(friendlyAuthError(msg), "Confirme o código do seu autenticador para alterar a senha.");
  assert.equal(friendlyAuthError("insufficient_aal"), "Confirme o código do seu autenticador para alterar a senha.");
});

test("F2: erro 500 do provedor de e-mail no cadastro vira a mensagem do e-mail, nunca o genérico", () => {
  for (const raw of [
    "gomail: could not send email 1: 550 Invalid `to` field",
    "Error sending confirmation email: 550 Invalid `to` field",
    "unexpected_failure",
  ]) {
    assert.equal(friendlyAuthError(raw, "cadastro"), MSG, raw);
  }
  // caso negativo: no login, "unexpected_failure" sozinho não vira mensagem de e-mail
  assert.notEqual(friendlyAuthError("unexpected_failure", "login"), MSG);
});

test("dddccd2f: cadastro com e-mail já existente NÃO revela que a conta existe (mensagem neutra)", () => {
  for (const raw of ["User already registered", "A user with this email address has already been registered"]) {
    const msg = friendlyAuthError(raw, "cadastro");
    assert.equal(msg, MSG_CADASTRO_NEUTRO, raw);
    assert.doesNotMatch(msg, /já possui|já existe|já cadastrad/i);
  }
});

test("dddccd2f: usuário ofuscado do Supabase (sem identities) é detectado; usuário novo não", () => {
  assert.equal(cadastroDuplicadoOfuscado({ identities: [] }), true);
  assert.equal(cadastroDuplicadoOfuscado({ identities: [{ id: "x" }] }), false);
  assert.equal(cadastroDuplicadoOfuscado({}), false);
  assert.equal(cadastroDuplicadoOfuscado(null), false);
});

test("dddccd2f: a espera do servidor (429 de /api/auth/entrar) chega à tela como 'Muitas tentativas'", () => {
  const msg = friendlyAuthError("Muitas tentativas. Aguarde um pouco para tentar de novo.");
  assert.match(msg, /muitas tentativas/i);
  assert.doesNotMatch(msg, /não foi possível concluir/i);
});
