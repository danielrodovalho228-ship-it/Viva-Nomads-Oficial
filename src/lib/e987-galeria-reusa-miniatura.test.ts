/*
  E987 (t707) — galeria aberta no computador: as fotos 2–5 não reaproveitavam a miniatura do mosaico (o E262 regrediu
  com o E768). A camada de baixo pedia a versão da miniatura grande (50vw) e o mosaico tinha baixado a do quadro (25vw):
  URL diferente, painel em branco. Agora a galeria pede o `sizes` do quadro de onde a foto veio (tipoDoQuadro).
  Roda: node --test src/lib/e987-galeria-reusa-miniatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tipoDoQuadro } from "./galeria-quadros.ts";

test("E987 — o tipo do quadro segue o layout do mosaico (1 foto; 2–4; 5+ com o '+N mais')", () => {
  assert.equal(tipoDoQuadro(0, 1), "miniatura");
  assert.equal(tipoDoQuadro(0, 8), "miniatura");
  assert.deepEqual([1, 2, 3].map((i) => tipoDoQuadro(i, 4)), ["coluna", "coluna", "coluna"]);
  assert.deepEqual([1, 2, 3, 4].map((i) => tipoDoQuadro(i, 8)), ["pequena", "pequena", "pequena", "pequena"]);
  assert.equal(tipoDoQuadro(5, 8), "miniatura"); // 6ª foto: fora do mosaico ("+N mais")
  // No celular a foto vem do carrossel: a miniatura em todas.
  assert.deepEqual([0, 1, 4, 6].map((i) => tipoDoQuadro(i, 8, false)), ["miniatura", "miniatura", "miniatura", "miniatura"]);
});

test("E987 — a camada de baixo da galeria usa o sizes do quadro (não mais a miniatura fixa)", () => {
  const g = readFileSync("src/components/property-gallery.tsx", "utf8");
  assert.match(g, /sizes=\{SIZES_POR_TIPO\[tipoDoQuadro\(index, photos\.length, noMosaico\)\]\}/);
  assert.match(g, /mosaicoNoComputador && typeof window !== "undefined" && window\.matchMedia\("\(min-width: 769px\)"\)\.matches/);
  assert.match(g, /miniatura: SIZES_MINIATURA, pequena: SIZES_MOSAICO_PEQUENA, coluna: SIZES_MOSAICO_COLUNA/);
  assert.doesNotMatch(g, /alt="" treat=\{false\} sizes=\{SIZES_MINIATURA\} fit="object-contain"/);
});
