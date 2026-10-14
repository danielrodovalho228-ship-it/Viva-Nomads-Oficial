import { test } from "node:test";
import assert from "node:assert/strict";
import { tituloDaBusca } from "./titulo-busca.ts";

test("título da busca acompanha local, contagem e filtros", () => {
  assert.equal(tituloDaBusca({ n: 38, local: "Uberlândia" }), "38 imóveis mobiliados em Uberlândia");
  assert.equal(tituloDaBusca({ n: 1, local: "  Centro,   Uberlândia " }), "1 imóvel mobiliado em Centro, Uberlândia");
  assert.equal(tituloDaBusca({ n: 0, local: "Corumbá" }), "Nenhum imóvel mobiliado em Corumbá");
  assert.equal(tituloDaBusca({ n: 12 }), "12 imóveis mobiliados para locação mensal");
  assert.equal(tituloDaBusca({ n: 5, local: "Uberlândia", pronto: true }), "5 imóveis Pronto para Morar em Uberlândia");
  assert.equal(tituloDaBusca({ n: 3, local: "Uberlândia", pet: true }), "3 imóveis mobiliados em Uberlândia que aceitam pets");
  assert.equal(tituloDaBusca({ n: 1, pet: true }), "1 imóvel mobiliado para locação mensal que aceita pets");
});
