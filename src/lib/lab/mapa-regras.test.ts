import { test } from "node:test";
import assert from "node:assert/strict";
import { problemasDoMapaAnonimo, tileTemChave, TAMANHO_TILE_CARIMBADO } from "./mapa-regras.ts";

const ok = { url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/10/1/2.png?key=abc", bytes: 15000 };

test("mapa limpo: todos com chave e nenhum carimbado", () => {
  assert.deepEqual(problemasDoMapaAnonimo([ok, ok]), []);
});

test("tile sem ?key= é apontado", () => {
  const sem = { url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/10/1/2.png", bytes: 9000 };
  assert.deepEqual(problemasDoMapaAnonimo([ok, sem]), ["1 tile(s) sem ?key="]);
});

test("tile de 2049 bytes (carimbado) é apontado mesmo com chave", () => {
  const carimbado = { ...ok, bytes: TAMANHO_TILE_CARIMBADO };
  assert.deepEqual(problemasDoMapaAnonimo([ok, carimbado]), ["1 tile(s) carimbado(s) de 2049 bytes"]);
});

test("zero tiles da CARTO é falha; outros domínios não contam", () => {
  assert.deepEqual(problemasDoMapaAnonimo([]), ["nenhum tile da CARTO foi pedido"]);
  assert.deepEqual(problemasDoMapaAnonimo([{ url: "https://outro.com/x.png", bytes: 1 }]), ["nenhum tile da CARTO foi pedido"]);
});

test("tileTemChave aceita key em qualquer posição da query", () => {
  assert.equal(tileTemChave("https://x/y.png?a=1&key=z"), true);
  assert.equal(tileTemChave("https://x/y.png?monkey=1"), false);
});
