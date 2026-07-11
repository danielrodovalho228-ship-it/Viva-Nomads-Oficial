/*
  Testes do "% completo" honesto do rascunho (P0 — salvamento e retomada).
  Roda com: node --experimental-strip-types --test src/lib/draft-progress.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { draftCompletionPct } from "./draft-progress.ts";
import { MIN_PHOTOS } from "./listing.ts";

test("fonte única: o mínimo de fotos do rascunho == MIN_PHOTOS do editor", () => {
  // Trava o espelho de MIN_PHOTOS em draft-progress: 7 fotos NÃO completam o
  // marco e MIN_PHOTOS completam. Se lib/listing mudar o mínimo, este teste
  // avisa para atualizar draft-progress também.
  const base = {
    street: "Rua A",
    neighborhood: "Centro",
    city: "Uberlândia",
    bathrooms: "1",
    areaM2: "45",
    minPeriod: "30",
    title: "Studio no Centro",
    monthlyPrice: "3200",
  };
  assert.equal(draftCompletionPct({ ...base, photos: Array(MIN_PHOTOS - 1).fill("u") }), 83);
  assert.equal(draftCompletionPct({ ...base, photos: Array(MIN_PHOTOS).fill("u") }), 100);
});

test("rascunho vazio/nulo: 0%", () => {
  assert.equal(draftCompletionPct(null), 0);
  assert.equal(draftCompletionPct(undefined), 0);
  assert.equal(draftCompletionPct({}), 0);
});

test("rascunho parcial: só endereço + título = 33%", () => {
  const pct = draftCompletionPct({
    street: "Rua A, 100",
    neighborhood: "Centro",
    city: "Uberlândia",
    title: "Studio mobiliado no Centro",
  });
  // 2 de 6 marcos (endereço, título) → 33%
  assert.equal(pct, 33);
});

test("rascunho completo (6 marcos): 100%", () => {
  const pct = draftCompletionPct({
    street: "Rua A, 100",
    neighborhood: "Centro",
    city: "Uberlândia",
    bathrooms: "1",
    areaM2: "45",
    minPeriod: "30",
    photos: Array(8).fill("https://x/y.jpg"),
    title: "Studio mobiliado no Centro",
    monthlyPrice: "3200",
  });
  assert.equal(pct, 100);
});

test("menos de 8 fotos NÃO conta o marco de fotos", () => {
  const base = {
    street: "Rua A, 100",
    neighborhood: "Centro",
    city: "Uberlândia",
    bathrooms: "1",
    areaM2: "45",
    minPeriod: "30",
    title: "Studio mobiliado no Centro",
    monthlyPrice: "3200",
  };
  // 5 de 6 (tudo menos fotos) → 83%
  assert.equal(draftCompletionPct({ ...base, photos: Array(7).fill("u") }), 83);
  // com 8 fotos → 100%
  assert.equal(draftCompletionPct({ ...base, photos: Array(8).fill("u") }), 100);
});

test("banheiro OU área faltando derruba o marco de detalhes", () => {
  const base = {
    street: "Rua A",
    neighborhood: "Centro",
    city: "Uberlândia",
    minPeriod: "30",
    title: "Studio no Centro mobiliado",
    monthlyPrice: "3200",
    photos: Array(8).fill("u"),
  };
  // sem banheiro/área → 5 de 6 → 83%
  assert.equal(draftCompletionPct(base), 83);
  // com banheiro mas área 0 → ainda 83%
  assert.equal(draftCompletionPct({ ...base, bathrooms: "1", areaM2: "0" }), 83);
  // com ambos → 100%
  assert.equal(draftCompletionPct({ ...base, bathrooms: "1", areaM2: "45" }), 100);
});
