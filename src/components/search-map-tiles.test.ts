/*
  Ordem 0ee6d5f6 (P0): o mapa da /buscar exibia "API KEY REQUIRED" por cima dos
  tiles — a CARTO passou a exigir chave. Mantém a CARTO (Voyager) com a chave
  gratuita vinda da variável NEXT_PUBLIC_CARTO_API_KEY — nunca no código.
  Roda: node --test src/components/search-map-tiles.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(new URL("./search-map.tsx", import.meta.url), "utf8");

test("tiles da CARTO Voyager com a chave lida de NEXT_PUBLIC_CARTO_API_KEY", () => {
  assert.match(src, /const CARTO_KEY = process\.env\.NEXT_PUBLIC_CARTO_API_KEY;/);
  assert.match(src, /https:\/\/basemaps\.cartocdn\.com\/rastertiles\/voyager\/\{z\}\/\{x\}\/\{y\}\.png\$\{CARTO_KEY \? `\?key=\$\{encodeURIComponent\(CARTO_KEY\)\}` : ""\}/);
  assert.match(src, /L\.tileLayer\(TILES_CARTO,/);
  assert.doesNotMatch(src, /light_all|tile\.openstreetmap\.org/);
});

test("a chave da CARTO não está escrita em nenhum arquivo do código", () => {
  const raiz = new URL("../", import.meta.url).pathname;
  const achados: string[] = [];
  const andar = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(tsx?|mjs|js|json|css)$/.test(p) && /cb1_[a-z0-9]+_\d+_[0-9a-f]{12,}/i.test(readFileSync(p, "utf8"))) achados.push(p);
    }
  };
  andar(raiz);
  assert.deepEqual(achados, []);
});

test("atribuição OpenStreetMap + CARTO visível no mapa", () => {
  assert.match(src, /OpenStreetMap<\/a> &copy; <a href="https:\/\/carto\.com\/attributions">CARTO<\/a>/);
});
