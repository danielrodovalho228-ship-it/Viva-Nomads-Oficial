import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Varredura 47 (07/11): no Fechamento, as pílulas do passo a passo mediam 36 px e dois controles ~40 px — abaixo de 44 px de toque.
const src = readFileSync(new URL("./closing-flow.tsx", import.meta.url), "utf8");

test("Fechamento: pílulas dos passos, ocupantes e prazo com área de toque de 44 px", () => {
  assert.match(src, /"flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm whitespace-nowrap/);
  assert.match(src, /aria-label="Número de ocupantes"\s+className="min-h-11 /);
  assert.match(src, /aria-label="Prazo total em meses"\s+className="min-h-11 /);
});
