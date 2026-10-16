/*
  Ordem b4fd5b18: o mapa da página do imóvel usa o mesmo caminho da /buscar.
  Roda: node --experimental-strip-types --test src/lib/mapa-base.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { borrarCoordenada, motorDoMapa, RAIO_APROXIMADO_KM } from "./mapa-base.ts";

const mapaImovel = readFileSync(new URL("../components/property-map.tsx", import.meta.url), "utf8");
const buscar = readFileSync(new URL("../components/search-map.tsx", import.meta.url), "utf8");

test("sem token Mapbox o motor é Leaflet (CARTO); com token, Mapbox", () => {
  assert.equal(motorDoMapa(undefined), "leaflet");
  assert.equal(motorDoMapa(""), "leaflet");
  assert.equal(motorDoMapa(null), "leaflet");
  assert.equal(motorDoMapa("pk.abc"), "mapbox");
});

test("coordenada arredondada: nunca o ponto exato, e o raio é ~500 m", () => {
  assert.equal(borrarCoordenada(-18.9112345), -18.911);
  assert.equal(borrarCoordenada(-48.26249), -48.262);
  assert.notEqual(borrarCoordenada(-18.9112345), -18.9112345);
  assert.equal(RAIO_APROXIMADO_KM, 0.5);
});

test("PropertyMap escolhe o motor pelo mesmo helper da /buscar e não cai mais no placeholder sem token", () => {
  assert.match(mapaImovel, /motorDoMapa\(TOKEN\) === "leaflet"\) return <PropertyMapLeaflet/);
  assert.match(buscar, /motorDoMapa\(TOKEN\) === "leaflet"\) return <SearchMapLeaflet/);
  // o placeholder antigo (grade + chips) foi removido
  assert.doesNotMatch(mapaImovel, /backgroundSize: "40px 40px"/);
  // tiles e atribuição vêm do módulo comum (sem duplicar a URL da CARTO)
  assert.match(mapaImovel, /from "@\/lib\/mapa-base"/);
  assert.doesNotMatch(mapaImovel, /cartocdn\.com/);
});

test("modo aproximado: círculo de ~500 m, coordenada arredondada, pino do imóvel escondido", () => {
  const leaflet = mapaImovel.slice(mapaImovel.indexOf("function PropertyMapLeaflet"));
  assert.match(leaflet, /approximate \? \{ lat: blur\(raw\.lat\), lng: blur\(raw\.lng\) \}/);
  assert.match(leaflet, /markers\.filter\(\(m\) => m\.kind !== "property"\)/);
  assert.match(leaflet, /L\.circle\(\[first\.lat, first\.lng\]/);
  assert.match(leaflet, /APPROX_RADIUS_KM \* 1000/);
  // o centro do mapa e do círculo é sempre `first` (já arredondado), nunca `raw`/`center`
  assert.doesNotMatch(leaflet, /setView\(\s*\[raw|\[center\.lat|L\.circle\(\[raw/);
  assert.match(leaflet, /attribution: ATRIBUICAO_MAPA/);
});
