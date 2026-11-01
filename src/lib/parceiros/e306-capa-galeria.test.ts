import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E306: a busca de parceiros traz a 1ª foto da galeria de quem não enviou capa (uma consulta só)", () => {
  const d = readFileSync(new URL("../data/parceiros-publico.ts", import.meta.url), "utf8");
  assert.match(d, /galeriaCapaUrl\?: string \| null;/);
  assert.match(d, /from\("parceiro_galeria"\)\.select\("parceiro_id, path, ordem"\)\.in\("parceiro_id", semCapa\)\.order\("ordem"\)/);
  assert.match(d, /galeriaCapaUrl: primeira\.get\(p\.id\)!/);
});
