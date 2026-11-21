/**
 * E442 (celular): no toque não existe hover — tocar no PREÇO do mapa abre o MESMO cartão do imóvel (foto, título, valor/mês e
 * link do anúncio certo). Guardas permanentes: (1) o toque é o `click` do pin nos DOIS mapas e escolhe o imóvel daquele pin;
 * (2) a prévia de hover fica inerte sem mouse de verdade (o mouseenter emulado pelo toque não abre uma prévia à parte);
 * (3) o cartão aberto é um só (`selectedId ?? previa.id`) e o clique no mapa/Esc fecha. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { temHoverDeVerdade } from "./previa-hover.ts";

const mapa = readFileSync(new URL("../search-map.tsx", import.meta.url), "utf8");
const mapbox = mapa.slice(mapa.indexOf("function SearchMapbox"), mapa.indexOf("function SearchMapLeaflet"));
const leaflet = mapa.slice(mapa.indexOf("function SearchMapLeaflet"));

test("Mapbox: tocar no preço seleciona o imóvel DAQUELE pin (e não deixa o toque cair no mapa)", () => {
  assert.match(mapbox, /el\.addEventListener\("click", \(e\) => \{\s*e\.stopPropagation\(\);\s*onSelectRef\.current\?\.\(p\.id\);/);
  assert.match(mapbox, /el\.dataset\.id = p\.id;/);
});

test("Leaflet: tocar no preço seleciona o imóvel DAQUELE pin", () => {
  assert.match(leaflet, /marker\.on\("click", \(\) => onSelectRef\.current\?\.\(p\.id\)\);/);
});

test("sem hover de verdade (toque), a prévia não abre: só o clique abre o cartão", () => {
  const w = globalThis as unknown as { window?: unknown };
  const antes = w.window;
  try {
    w.window = { matchMedia: (q: string) => ({ matches: q !== "(hover: hover) and (pointer: fine)" }) };
    assert.equal(temHoverDeVerdade(), false);
    w.window = { matchMedia: (q: string) => ({ matches: q === "(hover: hover) and (pointer: fine)" }) };
    assert.equal(temHoverDeVerdade(), true);
  } finally {
    if (antes === undefined) delete w.window;
    else w.window = antes;
  }
  const h = readFileSync(new URL("./previa-hover.ts", import.meta.url), "utf8");
  assert.match(h, /entrarPin: \(pid: string\) => \{\s*if \(!temHoverDeVerdade\(\)\) return;/);
});

test("o cartão aberto é um só nos dois mapas e fecha pelo clique no mapa", () => {
  for (const m of [mapbox, leaflet]) {
    assert.match(m, /const abertoId = selectedId \?\? previa\.id;/);
    assert.match(m, /<CardPinMapa property=\{aberto\} onFechar=\{fechar\} \/>/);
    assert.match(m, /previaRef\.current\.limpar\(\)/);
  }
});
