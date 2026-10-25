import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirCodigo, gerarCodigo, hashDoCodigo, MAX_TENTATIVAS } from "./codigo.ts";

const U = "11111111-1111-4111-8111-111111111111";
const agora = new Date("2026-10-25T12:00:00Z");
const pedido = (codigo: string, extra: Partial<{ expiraEm: string; tentativas: number }> = {}) => ({
  codigoHash: hashDoCodigo(U, codigo),
  expiraEm: "2026-10-25T12:15:00Z",
  tentativas: 0,
  ...extra,
});

test("o código tem 6 dígitos, com zeros à esquerda", () => {
  for (let i = 0; i < 200; i++) assert.match(gerarCodigo(), /^\d{6}$/);
});

test("o hash não contém o código e muda com a pessoa", () => {
  const h = hashDoCodigo(U, "042917");
  assert.ok(!h.includes("042917"));
  assert.notEqual(h, hashDoCodigo("22222222-2222-4222-8222-222222222222", "042917"));
});

test("código certo confirma (aceita espaços)", () => {
  assert.equal(conferirCodigo(U, "042917", pedido("042917"), agora), "ok");
  assert.equal(conferirCodigo(U, " 042 917 ", pedido("042917"), agora), "ok");
});

test("código errado ou fora do formato não confirma", () => {
  assert.equal(conferirCodigo(U, "042918", pedido("042917"), agora), "errado");
  assert.equal(conferirCodigo(U, "04291", pedido("042917"), agora), "errado");
  assert.equal(conferirCodigo(U, "abcdef", pedido("042917"), agora), "errado");
});

test("código vencido não confirma, mesmo o certo", () => {
  assert.equal(conferirCodigo(U, "042917", pedido("042917", { expiraEm: "2026-10-25T11:59:59Z" }), agora), "expirado");
});

test("depois de 5 erros bloqueia, mesmo com o código certo", () => {
  assert.equal(conferirCodigo(U, "042917", pedido("042917", { tentativas: MAX_TENTATIVAS }), agora), "bloqueado");
  assert.equal(conferirCodigo(U, "042917", pedido("042917", { tentativas: MAX_TENTATIVAS - 1 }), agora), "ok");
});
