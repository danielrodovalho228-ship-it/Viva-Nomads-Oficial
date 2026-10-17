import { test } from "node:test";
import assert from "node:assert/strict";
import { repartirSelos, MAX_SELOS_NA_FOTO } from "./card-selos.ts";

test("com todos os 6 selos, só 2 ficam na foto (Preço justo e Aceita pets) e 4 vão para a linha", () => {
  const r = repartirSelos({ precoJusto: true, pets: true, pronto: true, video: true, exemplo: true, destaque: true });
  assert.deepEqual(r.foto, ["precoJusto", "pets"]);
  assert.deepEqual(r.linha, ["pronto", "video", "exemplo", "destaque"]);
  assert.equal(r.foto.length, MAX_SELOS_NA_FOTO);
});

test("sem Preço justo, Aceita pets sobe; nunca passa de 2 na foto", () => {
  const r = repartirSelos({ pets: true, pronto: true, video: true });
  assert.deepEqual(r.foto, ["pets", "pronto"]);
  assert.deepEqual(r.linha, ["video"]);
});

test("caso negativo: sem selos nada aparece; com 1, a linha fica vazia", () => {
  assert.deepEqual(repartirSelos({}), { foto: [], linha: [] });
  assert.deepEqual(repartirSelos({ video: true }), { foto: ["video"], linha: [] });
});

import { readFileSync } from "node:fs";
const cartao = readFileSync(new URL("../components/property-card.tsx", import.meta.url), "utf8");
const busca = readFileSync(new URL("../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");

test("B1: o card usa repartirSelos e não empilha badges soltos na foto", () => {
  assert.match(cartao, /repartirSelos\(/);
  assert.match(cartao, /selos\.foto\.map/);
  assert.doesNotMatch(cartao, /\{property\.precoJusto && <PrecoJustoBadge/);
});

test("B2: /buscar mantém 3 por linha ao lado do mapa, registrado como exceção da grade par", () => {
  assert.match(busca, /xl:grid-cols-3/);
  assert.match(busca, /EXCEÇÃO da regra de grade par/);
});
