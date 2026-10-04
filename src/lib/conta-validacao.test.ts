/*
  Dados pessoais da Conta: nome, telefone e LinkedIn.
  Roda: node --test src/lib/conta-validacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarNome, normalizarTelefone, validarLinkedin, MSG_TELEFONE_EXTERIOR } from "./conta-validacao.ts";
import { telefoneParaWhatsapp } from "./notifications/whatsapp.ts";

test("nome: aceita nome real e limpa espaços", () => {
  assert.deepEqual(validarNome("  Daniel   Tomaz "), { ok: true, valor: "Daniel Tomaz" });
  assert.deepEqual(validarNome("Zé"), { ok: false, erro: "Informe seu nome completo." });
});

test("nome: recusa e-mail, telefone e link", () => {
  for (const n of ["daniel@x.com", "Daniel 34999990000", "Daniel www.site.com"]) {
    assert.equal(validarNome(n).ok, false, n);
  }
});

test("telefone: celular, fixo, +55 e vazio", () => {
  assert.deepEqual(normalizarTelefone("34 99999-0001"), { ok: true, valor: "(34) 99999-0001" });
  assert.deepEqual(normalizarTelefone("+55 (34) 3222-1100"), { ok: true, valor: "(34) 3222-1100" });
  assert.deepEqual(normalizarTelefone(""), { ok: true, valor: null });
});

test("telefone: recusa tamanho errado e celular sem 9", () => {
  assert.equal(normalizarTelefone("9999-0001").ok, false);
  assert.equal(normalizarTelefone("34 89999-0001").ok, false);
});

test("telefone: número dos EUA com + é aceito e formatado", () => {
  assert.deepEqual(normalizarTelefone("+1 641 629 6134"), { ok: true, valor: "+1 641 629 6134" });
  assert.deepEqual(normalizarTelefone("+16416296134"), { ok: true, valor: "+1 641 629 6134" });
});

test("telefone: número dos EUA SEM + não vira fixo de Goiás", () => {
  assert.deepEqual(normalizarTelefone("6416296134"), { ok: false, erro: MSG_TELEFONE_EXTERIOR });
});

test("telefone: fixo brasileiro válido continua aceito", () => {
  assert.deepEqual(normalizarTelefone("(34) 3222-1234"), { ok: true, valor: "(34) 3222-1234" });
});

test("telefone: outros países e +55", () => {
  assert.deepEqual(normalizarTelefone("+44 7911 123456"), { ok: true, valor: "+447911123456" });
  assert.deepEqual(normalizarTelefone("+55 34 99999-0001"), { ok: true, valor: "(34) 99999-0001" });
  assert.equal(normalizarTelefone("+12").ok, false);
});

test("linkedin: normaliza perfil e recusa outro site", () => {
  assert.deepEqual(validarLinkedin("linkedin.com/in/daniel/"), { ok: true, valor: "https://linkedin.com/in/daniel" });
  assert.deepEqual(validarLinkedin(""), { ok: true, valor: null });
  assert.equal(validarLinkedin("https://golpe.com/in/x").ok, false);
});

test("WhatsApp recebe E.164 sem + a partir do telefone gravado", () => {
  assert.equal(telefoneParaWhatsapp("(34) 99999-0000"), "5534999990000");
  assert.equal(telefoneParaWhatsapp("(34) 3222-1234"), "553432221234");
  assert.equal(telefoneParaWhatsapp("+1 641 629 6134"), "16416296134");
  assert.equal(telefoneParaWhatsapp("+447911123456"), "447911123456");
  assert.equal(telefoneParaWhatsapp("123"), null);
});
