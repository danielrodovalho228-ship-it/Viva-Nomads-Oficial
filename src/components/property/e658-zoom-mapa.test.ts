import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E658: a legenda do mapa em tela cheia não pode cobrir o botão (+) do zoom (topo esquerdo).
const nearby = readFileSync("src/components/property/location-nearby.tsx", "utf8");
const mapa = readFileSync("src/components/property-map.tsx", "utf8");

test("E658: legenda começa depois do controle de zoom", () => {
  const m = nearby.match(/data-testid="mapa-tela-cheia-legenda" className="([^"]+)"/);
  assert.ok(m, "legenda existe");
  assert.match(m[1], /\bleft-14\b/);
  assert.doesNotMatch(m[1], /\bleft-3\b/);
});

test("E658: zoom segue no topo esquerdo", () => {
  assert.match(mapa, /L\.control\.zoom\(\{ position: "topleft" \}\)/);
});
