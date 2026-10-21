import { test } from "node:test";
import assert from "node:assert/strict";
import { repartirSelos, MAX_SELOS_NA_FOTO, seloDoCartao, ROTULO_SELO_UNICO } from "./card-selos.ts";

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

test("adendo do Prompt 40 (substitui a B1): no máximo 1 selo — verificado → Preço justo → Aceita pets", () => {
  assert.equal(seloDoCartao({ verificado: true, precoJusto: true, pets: true }), "verificado");
  assert.equal(seloDoCartao({ precoJusto: true, pets: true }), "precoJusto");
  assert.equal(seloDoCartao({ pets: true }), "pets");
  assert.equal(seloDoCartao({}), null);
  assert.equal(ROTULO_SELO_UNICO.verificado, "Proprietário verificado");
  assert.match(cartao, /const selo = seloDoCartao\(/);
  assert.match(cartao, /\{selo && <Selo id=\{selo\} \/>\}/);
  assert.doesNotMatch(cartao, /repartirSelos|selos\.foto\.map|selos\.linha/);
});

test("B2: /buscar mantém 3 por linha ao lado do mapa, registrado como exceção da grade par", () => {
  assert.match(busca, /xl:grid-cols-3/);
  assert.match(busca, /EXCEÇÃO da regra de grade par/);
});
