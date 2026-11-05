/*
  E575 — e-mail "Sua parceria foi aprovada: ative sua página": a versão em texto traz a URL de ativação visível e a
  saudação usa o primeiro nome de verdade (a conta de teste "[TESTE QA] Marina Souza" saía "Olá [TESTE,").
  Roda: node --test src/lib/notifications/e575-parceria-aprovada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { primeiroNome } from "../display-name.ts";
import { emailParceriaAprovada } from "./montar-email.ts";

const SITE = "https://vivanomads.com.br";
const URL_ATIVAR = `${SITE}/parceiros/ativar?t=abc123`;

test("primeiroNome tira a marca entre colchetes das contas de teste", () => {
  assert.equal(primeiroNome("[TESTE QA] Marina Souza"), "Marina");
  assert.equal(primeiroNome("[TESTE] [QA] Ana"), "Ana");
  assert.equal(primeiroNome("Marina Souza"), "Marina");
  assert.equal(primeiroNome("[TESTE QA]"), "");
  assert.equal(primeiroNome("marina@x.com"), "");
  assert.equal(primeiroNome(null), "");
});

test("e-mail de parceria aprovada: saudação pelo primeiro nome, nunca 'Olá [TESTE,'", () => {
  const e = emailParceriaAprovada(SITE, { url: URL_ATIVAR, nome: "[TESTE QA] Marina Souza" });
  assert.match(e.text, /Olá Marina,/);
  assert.match(e.html, /Olá Marina,/);
  assert.doesNotMatch(e.text, /\[TESTE/);
  assert.doesNotMatch(e.html, /Olá \[TESTE/);
});

test("versão em texto traz a URL de ativação visível (e não remete ao botão da versão completa)", () => {
  const e = emailParceriaAprovada(SITE, { url: URL_ATIVAR, nome: "Marina" });
  assert.ok(e.text.includes(URL_ATIVAR), "URL de ativação no texto");
  assert.match(e.text, /Ativar minha página/);
  assert.doesNotMatch(e.text, /versão completa/);
  assert.doesNotMatch(e.text, /botão abaixo/);
});

test("sem nome: saudação neutra", () => {
  const e = emailParceriaAprovada(SITE, { url: URL_ATIVAR, nome: null });
  assert.match(e.text, /Olá, a sua parceria/);
});
