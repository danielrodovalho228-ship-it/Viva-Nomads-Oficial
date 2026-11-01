import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Varredura 01/11 (achado 9): o número de cada passo em /como-funciona era sage-200 sobre branco (1,25:1; texto grande
// pede 3:1). Agora na cor da marca (forest #1c6b3a, ~6,4:1).
test("números dos passos de Como funciona com contraste legível", () => {
  const p = readFileSync(new URL("../../app/(public)/como-funciona/page.tsx", import.meta.url), "utf8");
  assert.match(p, /<span className="font-title text-2xl font-semibold text-forest">\{i \+ 1\}<\/span>/);
  assert.doesNotMatch(p, /font-semibold text-sage-200">\{i \+ 1\}/);
});
