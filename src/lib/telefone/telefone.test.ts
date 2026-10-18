/* Roda: node --test src/lib/telefone/telefone.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chavesLimiteSms,
  codigoValido,
  digitosCelular,
  limparCodigo,
  mascaraCelular,
  provedorSmsPronto,
  seloTelefone,
  segundosParaReenviar,
  validarCelularBR,
} from "./telefone.ts";

test("máscara (XX) 9XXXX-XXXX enquanto digita, e colar com +55", () => {
  assert.equal(mascaraCelular(""), "");
  assert.equal(mascaraCelular("3"), "(3");
  assert.equal(mascaraCelular("349"), "(34) 9");
  assert.equal(mascaraCelular("3499999"), "(34) 99999");
  assert.equal(mascaraCelular("34999990000"), "(34) 99999-0000");
  assert.equal(mascaraCelular("+55 (34) 99999-0000"), "(34) 99999-0000");
  assert.equal(mascaraCelular("349999900001234"), "(34) 99999-0000");
  assert.equal(digitosCelular("5534999990000"), "34999990000");
});

test("validação do celular BR: DDD real, 11 dígitos, começa com 9", () => {
  assert.deepEqual(validarCelularBR("(34) 99999-0123"), { ok: true, e164: "5534999990123" });
  assert.deepEqual(validarCelularBR("+55 11 98765-4321"), { ok: true, e164: "5511987654321" });
  for (const ruim of ["", "123", "(34) 3333-4444", "(34) 83333-4444", "(20) 99999-0123", "(00) 99999-0123", "(34) 99999-999", "(34) 99999-9999"])
    assert.equal(validarCelularBR(ruim).ok, false, ruim);
});

test("código de 6 dígitos", () => {
  assert.equal(limparCodigo(" 12a34 56 7"), "123456");
  assert.equal(codigoValido("123456"), true);
  assert.equal(codigoValido("12345"), false);
  assert.equal(codigoValido("12345a"), false);
});

test("Reenviar só depois de 60 s", () => {
  assert.equal(segundosParaReenviar(null, 0), 0);
  assert.equal(segundosParaReenviar(1_000, 1_000), 60);
  assert.equal(segundosParaReenviar(1_000, 31_000), 30);
  assert.equal(segundosParaReenviar(1_000, 61_000), 0);
  assert.equal(segundosParaReenviar(1_000, 99_000), 0);
});

test("limites: 3/hora e 5/dia, por usuário e por IP, sem o número na chave", () => {
  const c = chavesLimiteSms("u1", "iphash");
  assert.deepEqual(
    c.map((x) => [x.chave, x.maximo, x.janelaSegundos]),
    [
      ["sms:u:u1:h", 3, 3600],
      ["sms:ip:iphash:h", 3, 3600],
      ["sms:u:u1:d", 5, 86400],
      ["sms:ip:iphash:d", 5, 86400],
    ],
  );
  for (const x of c) assert.doesNotMatch(x.chave, /\d{8,}/);
});

test("selo liga só com confirmação do Supabase E registro da Viva; trocar o número zera", () => {
  assert.equal(seloTelefone({ phoneConfirmedAt: null, verificadoEm: null }), false);
  assert.equal(seloTelefone({ phoneConfirmedAt: "2026-10-17T10:00:00Z", verificadoEm: "2026-10-17T10:00:00Z" }), true);
  // Pediu código para outro número: a Viva zera o registro → selo some, mesmo com o confirmado antigo no Supabase.
  assert.equal(seloTelefone({ phoneConfirmedAt: "2026-10-17T10:00:00Z", verificadoEm: null }), false);
  assert.equal(seloTelefone({ phoneConfirmedAt: null, verificadoEm: "2026-10-17T10:00:00Z" }), false);
});

test("provedor pronto só com telefone ligado, provedor definido e SEM autoconfirmação", () => {
  assert.equal(provedorSmsPronto(null), false);
  assert.equal(provedorSmsPronto({ external: { phone: false }, sms_provider: "", phone_autoconfirm: true }), false);
  assert.equal(provedorSmsPronto({ external: { phone: true }, sms_provider: "twilio_verify", phone_autoconfirm: true }), false);
  assert.equal(provedorSmsPronto({ external: { phone: true }, sms_provider: "", phone_autoconfirm: false }), false);
  assert.equal(provedorSmsPronto({ external: { phone: true }, sms_provider: "twilio_verify", phone_autoconfirm: false }), true);
});
