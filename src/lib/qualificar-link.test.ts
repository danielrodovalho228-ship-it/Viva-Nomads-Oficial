/*
  F8 — o aviso "Antes de anunciar" nunca aponta para a própria página.
  Roda: node --test src/lib/qualificar-link.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { linkQualificacao, rotaVoltarAoAnuncio } from "./qualificar-link.ts";

const ID = "ddf86c66-a214-463d-8563-66a5204010b5";

test("com id válido leva ao checklist daquele imóvel", () => {
  assert.equal(linkQualificacao(ID), `/qualificar?imovel=${ID}`);
});

test("sem id (rascunho não salvo) não devolve link", () => {
  assert.equal(linkQualificacao(null), null);
  assert.equal(linkQualificacao(undefined), null);
  assert.equal(linkQualificacao(""), null);
});

test("id malformado não vira link", () => {
  assert.equal(linkQualificacao("../novo"), null);
  assert.equal(linkQualificacao(`${ID}&x=1`), null);
});

test("voltar ao anúncio: rascunho reabre por ?draft=, publicado pela edição, sem imóvel um anúncio novo", () => {
  assert.equal(rotaVoltarAoAnuncio({ id: ID, rascunho: true }), `/dashboard/imoveis/novo?draft=${ID}`);
  assert.equal(rotaVoltarAoAnuncio({ id: ID, rascunho: false }), `/dashboard/imoveis/novo?id=${ID}`);
  assert.equal(rotaVoltarAoAnuncio(null), "/dashboard/imoveis/novo");
});
