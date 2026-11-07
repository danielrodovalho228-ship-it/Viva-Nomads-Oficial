import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Passada 57 (07/11, 390 px): os botões "Cobrado à parte" / "Incluído no valor mensal" do simulador mediam ~34 px de altura.
const src = readFileSync(new URL("./ui.tsx", import.meta.url), "utf8");

test("simulador: os botões de rádio de cobrança têm 44 px de toque", () => {
  assert.match(src, /role="radio"[\s\S]{0,160}className=\{`min-h-11 rounded-lg border px-3 py-2 text-xs/);
});
