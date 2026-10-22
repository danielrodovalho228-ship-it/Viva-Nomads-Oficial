import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoMapas } from "./mapas.ts";

test("mapa e lugares próximos desligados sem nenhuma chave", () => {
  assert.deepEqual(estadoMapas({}), { mapa: false, lugaresProximos: false });
});

test("mapa liga só com o token do Mapbox; espaços em branco não contam", () => {
  assert.equal(estadoMapas({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.abc" }).mapa, true);
  assert.equal(estadoMapas({ NEXT_PUBLIC_MAPBOX_TOKEN: "   " }).mapa, false);
  assert.equal(estadoMapas({ GOOGLE_PLACES_API_KEY: "k" }).mapa, false);
});

test("lugares próximos ligam com GOOGLE_PLACES_API_KEY ou com o apelido GOOGLE_MAPS_API_KEY", () => {
  assert.equal(estadoMapas({ GOOGLE_PLACES_API_KEY: "k" }).lugaresProximos, true);
  assert.equal(estadoMapas({ GOOGLE_MAPS_API_KEY: "k" }).lugaresProximos, true);
  assert.equal(estadoMapas({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.abc" }).lugaresProximos, false);
});

test("a política de segurança (CSP) libera o Mapbox: api, events, imagens e worker blob:", () => {
  const cfg = readFileSync("next.config.ts", "utf8");
  const linha = (d: string) => cfg.split("\n").find((l) => l.includes(`"${d} `)) ?? "";
  assert.match(linha("connect-src"), /https:\/\/api\.mapbox\.com/);
  assert.match(linha("connect-src"), /https:\/\/events\.mapbox\.com/);
  assert.match(linha("img-src"), /blob:/);
  assert.match(linha("img-src"), /https:/);
  assert.match(linha("worker-src"), /blob:/);
});
