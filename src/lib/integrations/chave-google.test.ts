import test from "node:test";
import assert from "node:assert/strict";
import { chaveGoogle } from "./chave-google.ts";

test("GOOGLE_PLACES_API_KEY é a chave oficial", () => {
  assert.equal(chaveGoogle({ GOOGLE_PLACES_API_KEY: "p" }), "p");
});

test("GOOGLE_MAPS_API_KEY vale como apelido", () => {
  assert.equal(chaveGoogle({ GOOGLE_MAPS_API_KEY: "m" }), "m");
});

test("a oficial vence o apelido", () => {
  assert.equal(chaveGoogle({ GOOGLE_PLACES_API_KEY: "p", GOOGLE_MAPS_API_KEY: "m" }), "p");
});

test("sem chave (ou só espaços) devolve vazio", () => {
  assert.equal(chaveGoogle({}), "");
  assert.equal(chaveGoogle({ GOOGLE_PLACES_API_KEY: "  " }), "");
});

// Ordem 902ea6bf item 1: a chave única precisa estar documentada no README.
test("README documenta a chave única do Google, o apelido e o token do Mapbox", async () => {
  const { readFileSync } = await import("node:fs");
  const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
  assert.match(readme, /GOOGLE_PLACES_API_KEY/);
  assert.match(readme, /GOOGLE_MAPS_API_KEY[^\n]*apelido/);
  assert.match(readme, /NEXT_PUBLIC_MAPBOX_TOKEN/);
  assert.match(readme, /Mapa: ligado\/desligado/);
});
