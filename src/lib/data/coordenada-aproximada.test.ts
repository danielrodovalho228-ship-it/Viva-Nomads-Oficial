/*
  Pins da busca pública não carregam a coordenada exata do imóvel (ordem 7193d35a / 759ce6d0).
  Roda: node --test src/lib/data/coordenada-aproximada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aproximarCoordenada, comCoordenadaAproximada } from "./coordenada-aproximada.ts";

const casas = (n: number) => (String(n).split(".")[1] ?? "").length;

test("arredonda para no máximo 3 casas decimais", () => {
  for (const n of [-23.5613987, -46.6565432, 0.123456789, -23.5]) {
    assert.ok(casas(aproximarCoordenada(n)) <= 3, String(n));
  }
  assert.equal(aproximarCoordenada(-23.5613987), -23.561);
});

test("não muta o imóvel original e preserva os outros campos", () => {
  const p = { id: "a", lat: -23.5613987, lng: -46.6565432 };
  const q = comCoordenadaAproximada(p);
  assert.equal(q.id, "a");
  assert.ok(casas(q.lat) <= 3 && casas(q.lng) <= 3);
  assert.equal(p.lat, -23.5613987);
});

test("caso negativo: a coordenada exata não sobrevive no resultado", () => {
  const q = comCoordenadaAproximada({ lat: -23.5613987, lng: -46.6565432 });
  assert.notEqual(q.lat, -23.5613987);
  assert.notEqual(q.lng, -46.6565432);
});

test("listProperties (fonte da /buscar) aplica o arredondamento no servidor", () => {
  const src = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
  assert.match(src, /\.map\(rowToProperty\)\.map\(comCoordenadaAproximada\)\)/);
});

// ---- Ordem 00552cd1: anúncio público e JSON-LD também sem coordenada exata ----
test("deslocamento estável por imóvel: mesmo id → mesmo ponto; ids diferentes → pontos diferentes", () => {
  const exato = { lat: -23.5613987, lng: -46.6565432 };
  const a1 = comCoordenadaAproximada({ id: "imovel-a", ...exato });
  const a2 = comCoordenadaAproximada({ id: "imovel-a", ...exato });
  assert.deepEqual(a1, a2);
  const pontos = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => {
      const q = comCoordenadaAproximada({ id, ...exato });
      return `${q.lat},${q.lng}`;
    })
  );
  assert.ok(pontos.size >= 4, "ids diferentes não caem todos no mesmo ponto");
});

test("deslocamento fica dentro de ~500 m e nunca devolve o ponto exato", () => {
  for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const q = comCoordenadaAproximada({ id, lat: -23.5613987, lng: -46.6565432 });
    assert.ok(Math.abs(q.lat - -23.5613987) < 0.0046, id);
    assert.ok(Math.abs(q.lng - -46.6565432) < 0.0046, id);
    assert.ok(casas(q.lat) <= 3 && casas(q.lng) <= 3, id);
  }
});

test("getProperty (página pública) aplica a aproximação no servidor; dono continua exato", () => {
  const src = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
  const publico = src.slice(src.indexOf("export async function getProperty("), src.indexOf("export async function getPropertyForOwner"));
  assert.match(publico, /comCoordenadaAproximada\(rowToProperty/);
  const dono = src.slice(src.indexOf("export async function getPropertyForOwner"), src.indexOf("async function attachCoverPhotos"));
  assert.doesNotMatch(dono, /comCoordenadaAproximada/);
});

test("JSON-LD do imóvel não traz geo (só cidade/bairro)", () => {
  const src = readFileSync(new URL("../../components/seo/property-json-ld.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /GeoCoordinates|latitude|longitude/);
});
