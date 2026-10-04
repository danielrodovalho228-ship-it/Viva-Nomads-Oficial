/*
  Id determinístico da conversa (uuid v5).
  Roda: node --test src/lib/messages/conversation-id.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { conversationId, uuidV5 } from "./conversation-id.ts";

const INQ = "22222222-2222-2222-2222-222222222222";
const DONO = "11111111-1111-1111-1111-111111111111";
const IMOVEL = "aaaaaaa1-0000-0000-0000-000000000001";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("uuid v5 confere com o vetor da RFC (DNS, www.example.com)", () => {
  assert.equal(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
});

test("é um uuid válido (versão 5) — cabe na coluna uuid", () => {
  assert.match(conversationId(INQ, DONO, IMOVEL), UUID);
});

test("inquilino→dono e dono→inquilino caem na MESMA conversa", () => {
  assert.equal(conversationId(INQ, DONO, IMOVEL), conversationId(DONO, INQ, IMOVEL));
});

test("maiúsculas no id não mudam a conversa", () => {
  assert.equal(conversationId(INQ.toUpperCase(), DONO, IMOVEL), conversationId(INQ, DONO, IMOVEL.toUpperCase()));
});

test("cada imóvel tem a sua conversa", () => {
  assert.notEqual(conversationId(INQ, DONO, IMOVEL), conversationId(INQ, DONO, "aaaaaaa3-0000-0000-0000-000000000003"));
});

test("sem imóvel: null, undefined e '' são a mesma conversa (e diferente da com imóvel)", () => {
  const semImovel = conversationId(INQ, DONO);
  assert.equal(conversationId(DONO, INQ, null), semImovel);
  assert.equal(conversationId(INQ, DONO, ""), semImovel);
  assert.notEqual(semImovel, conversationId(INQ, DONO, IMOVEL));
});

test("outra pessoa = outra conversa", () => {
  assert.notEqual(conversationId(INQ, DONO, IMOVEL), conversationId("33333333-3333-3333-3333-333333333333", DONO, IMOVEL));
});
