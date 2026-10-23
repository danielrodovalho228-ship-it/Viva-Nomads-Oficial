import test from "node:test";
import assert from "node:assert/strict";
import { idsRascunhosDuplicados } from "./rascunhos-duplicados.ts";

const r = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "draft",
  title: "Studio mobiliado no Centro",
  city: "Uberlândia",
  neighborhood: "Centro",
  bedrooms: 1,
  ...over,
});

test("dois rascunhos idênticos são marcados", () => {
  assert.deepEqual([...idsRascunhosDuplicados([r("a"), r("b")])].sort(), ["a", "b"]);
});

test("ignora maiúsculas, acento e espaços repetidos", () => {
  const s = idsRascunhosDuplicados([r("a"), r("b", { title: "  STUDIO  mobiliado no centro " })]);
  assert.equal(s.size, 2);
});

test("caso negativo: bairro, quartos ou cidade diferentes não são duplicados", () => {
  assert.equal(idsRascunhosDuplicados([r("a"), r("b", { neighborhood: "Santa Mônica" })]).size, 0);
  assert.equal(idsRascunhosDuplicados([r("a"), r("b", { bedrooms: 2 })]).size, 0);
  assert.equal(idsRascunhosDuplicados([r("a"), r("b", { city: "Goiânia" })]).size, 0);
});

test("caso negativo: anúncio no ar com o mesmo título não marca o rascunho", () => {
  assert.equal(idsRascunhosDuplicados([r("a"), r("b", { status: "active" })]).size, 0);
});

test("caso negativo: rascunho sem título nunca é duplicado", () => {
  assert.equal(idsRascunhosDuplicados([r("a", { title: "" }), r("b", { title: "  " })]).size, 0);
});
