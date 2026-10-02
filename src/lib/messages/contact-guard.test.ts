/** Testes da proteção de contato no chat — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardContactInfo } from "./contact-guard.ts";

const MASK = "🔒 [contato protegido]";

test("mascara celular com DDD (formatado)", () => {
  const r = guardContactInfo("me chama no (34) 99999-0001 por favor");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("99999"));
  assert.ok(r.text.includes(MASK));
});

test("mascara celular colado e com +55", () => {
  assert.equal(guardContactInfo("meu número é 34999990001").masked, true);
  assert.equal(guardContactInfo("liga no +55 34 9 9999-0001").masked, true);
});

test("mascara e-mail", () => {
  const r = guardContactInfo("manda pra ana.silva+vn@gmail.com");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("@gmail.com"));
});

test("mascara link de WhatsApp/Telegram", () => {
  assert.equal(guardContactInfo("https://wa.me/5534999990001 me add").masked, true);
  assert.equal(guardContactInfo("t.me/fulano").masked, true);
});

test("mascara perfil de rede social por URL", () => {
  assert.equal(guardContactInfo("meu insta é instagram.com/maria.nomad").masked, true);
  assert.equal(guardContactInfo("https://www.facebook.com/fulano.de.tal").masked, true);
  assert.equal(guardContactInfo("tiktok.com/@viajante").masked, true);
});

test("mascara @handle solto (me chama no insta @maria.silva)", () => {
  const r = guardContactInfo("me chama no insta @maria.silva");
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("@maria.silva"));
  assert.ok(r.text.includes(MASK));
});

test("T-TRAV-F: mascara os 3 padrões (telefone, e-mail, @instagram)", () => {
  const r = guardContactInfo(
    "liga (34) 99999-0001, e-mail joao@teste.com ou me segue no insta @joao.nomad",
  );
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes("99999"), "telefone não mascarado");
  assert.ok(!r.text.includes("joao@teste.com"), "e-mail não mascarado");
  assert.ok(!r.text.includes("@joao.nomad"), "handle não mascarado");
});

test("NÃO mascara CEP, data, valor e texto comum", () => {
  for (const s of [
    "o CEP é 38400-000",
    "entrada em 02/07/2026",
    "o aluguel é R$ 3.200 e a caução R$ 6.400",
    "o prédio tem 20 andares e fica no número 1520",
    "Olá! O imóvel está disponível a partir de agosto?",
  ]) {
    const r = guardContactInfo(s);
    assert.equal(r.masked, false, `não deveria mascarar: "${s}" → "${r.text}"`);
    assert.equal(r.text, s);
  }
});

test("é idempotente (mascarar duas vezes não muda)", () => {
  const once = guardContactInfo("tel (34) 99999-0001").text;
  assert.equal(guardContactInfo(once).text, once);
});
