import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 0f66a754 (item 1): as funções ficam na mesma região do banco (Supabase
// em us-east-1 / Virgínia = iad1). Em São Paulo (gru1) cada consulta atravessava
// SP↔EUA (~120–150 ms) e uma página com várias consultas somava segundos.
test("vercel.json: funções na região do banco (iad1)", () => {
  const cfg = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(cfg.regions, ["iad1"]);
});
