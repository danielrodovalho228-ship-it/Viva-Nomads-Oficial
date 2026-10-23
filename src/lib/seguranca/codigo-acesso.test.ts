import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESPERA_REENVIO_S,
  MAX_TENTATIVAS_CODIGO,
  codigoCompleto,
  mensagemEnvioCodigo,
  mensagemVerificarCodigo,
  normalizarCodigo,
  segundosParaReenviar,
  tentativasRestantes,
} from "./codigo-acesso.ts";

test("normalizarCodigo deixa só 6 dígitos (colar com espaço ou traço)", () => {
  assert.equal(normalizarCodigo("123 456"), "123456");
  assert.equal(normalizarCodigo("123-456"), "123456");
  assert.equal(normalizarCodigo("12345678"), "123456");
  assert.equal(normalizarCodigo("abc"), "");
});

test("codigoCompleto exige exatamente 6 dígitos", () => {
  assert.equal(codigoCompleto("123456"), true);
  assert.equal(codigoCompleto("12345"), false);
  assert.equal(codigoCompleto("12345a"), false);
});

test("reenvio só depois de 60 s", () => {
  assert.equal(segundosParaReenviar(0, 0), ESPERA_REENVIO_S);
  assert.equal(segundosParaReenviar(0, 30_000), 30);
  assert.equal(segundosParaReenviar(0, 61_000), 0);
});

test("teto de tentativas erradas", () => {
  assert.equal(tentativasRestantes(0), MAX_TENTATIVAS_CODIGO);
  assert.equal(tentativasRestantes(MAX_TENTATIVAS_CODIGO + 3), 0);
});

test("pedir código não revela se o e-mail tem conta", () => {
  assert.equal(mensagemEnvioCodigo("Signups not allowed for otp"), null);
  assert.equal(mensagemEnvioCodigo("User not found"), null);
  assert.match(mensagemEnvioCodigo("email rate limit exceeded")!, /Aguarde um pouco/);
  assert.match(mensagemEnvioCodigo("boom")!, /Não foi possível enviar/);
});

test("código errado e vencido têm a mesma mensagem", () => {
  assert.equal(mensagemVerificarCodigo("Token has expired or is invalid"), mensagemVerificarCodigo("invalid"));
  assert.match(mensagemVerificarCodigo("Token has expired or is invalid"), /incorreto ou vencido/);
});
