/*
  Dados pessoais da Conta: nome, telefone e LinkedIn.
  Roda: node --test src/lib/conta-validacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarNome, normalizarTelefone, validarLinkedin } from "./conta-validacao.ts";

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

test("linkedin: normaliza perfil e recusa outro site", () => {
  assert.deepEqual(validarLinkedin("linkedin.com/in/daniel/"), { ok: true, valor: "https://linkedin.com/in/daniel" });
  assert.deepEqual(validarLinkedin(""), { ok: true, valor: null });
  assert.equal(validarLinkedin("https://golpe.com/in/x").ok, false);
});
