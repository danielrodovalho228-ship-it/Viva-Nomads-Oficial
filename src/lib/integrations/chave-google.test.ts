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
