/* Roda: node --test src/lib/dv-buscar-primeira-dobra.test.ts — D-V: fotos da primeira dobra de /buscar não esperam a rolagem (t249, 1280 px). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");

test("/buscar: a 1ª foto dos 6 primeiros cartões baixa já; os demais seguem preguiçosos", () => {
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.match(busca, /const CARTOES_PRIMEIRA_DOBRA = 6;/);
  assert.match(busca, /carregarJa=\{i < CARTOES_PRIMEIRA_DOBRA\}/);
  assert.match(ler("components/property-card.tsx"), /carregarJa=\{carregarJa\}/);
  assert.match(ler("components/property/fotos-cartao.tsx"), /carregarJa=\{carregarJa && i === 0\}/);
});

test("BrandImage: carregarJa só troca o loading, sem preload (que fica com a imagem principal)", () => {
  const img = ler("components/brand-image.tsx");
  assert.match(img, /carregarJa && !priority \? \{ loading: "eager" as const \} : \{\}/);
  assert.doesNotMatch(img, /carregarJa[^\n]*fetchPriority/);
});
