import { test } from "node:test";
import assert from "node:assert/strict";
import { itensSintese } from "./cartao-sintese.ts";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { readFileSync } from "node:fs";

const textos = (p: Parameters<typeof itensSintese>[0]) => itensSintese(p).map((i) => i.texto).join(" · ");

test("síntese: anúncio completo mostra os 4 itens, na ordem", () => {
  assert.equal(textos({ bedrooms: 2, bathrooms: 1, areaM2: 65, furnished: true }), "2 quartos · 1 banheiro · 65 m² · mobiliado");
});

test("síntese: anúncio parcial — o item sem dado sai, sem traço nem zero", () => {
  assert.equal(textos({ bedrooms: 1, bathrooms: 0, areaM2: 40 }), "1 quarto · 40 m²");
  assert.equal(textos({ bathrooms: 2, furnished: true }), "2 banheiros · mobiliado");
  assert.doesNotMatch(textos({ bedrooms: 0, bathrooms: 1, areaM2: null }), /—|0 quartos|0 m²/);
});

test("síntese: sem nenhum dado, a linha some (lista vazia)", () => {
  assert.deepEqual(itensSintese({}), []);
  assert.deepEqual(itensSintese({ bedrooms: 0, bathrooms: 0, areaM2: 0, furnished: false }), []);
});

test("síntese: todos os anúncios de exemplo têm quartos e banheiros", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const chaves = itensSintese(p).map((i) => i.chave);
    assert.ok(chaves.includes("quartos") && chaves.includes("banheiros"), p.id);
  }
});

test("cartão usa a síntese e a mostra só com algum item", () => {
  const c = readFileSync(new URL("../components/property-card.tsx", import.meta.url), "utf8");
  assert.match(c, /const sintese = itensSintese\(property\);/);
  assert.match(c, /\{sintese\.length > 0 && \(/);
  assert.doesNotMatch(c, /<IdealPara/); // "Ideal para" foi para a página do imóvel
});
