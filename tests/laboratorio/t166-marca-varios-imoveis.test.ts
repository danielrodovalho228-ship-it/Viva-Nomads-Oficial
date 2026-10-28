import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab fc96d3c4: o t166 marcava só o imóvel mais novo, que nem sempre aparece na /buscar. A spec marca vários.
const spec = readFileSync("tests/e2e/specs/t166-selo-visto-busca.spec.ts", "utf8");

test("t166: marca vários imóveis ativos como vistos e limpa todos no fim", () => {
  assert.doesNotMatch(spec, /\.limit\(1\)\.single\(\)/);
  assert.match(spec, /\.limit\(60\)/);
  assert.match(spec, /\.in\("imovel_id", imovelIds\)/);
});
