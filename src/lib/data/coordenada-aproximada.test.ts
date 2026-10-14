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
  assert.deepEqual(q, { id: "a", lat: -23.561, lng: -46.657 });
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
