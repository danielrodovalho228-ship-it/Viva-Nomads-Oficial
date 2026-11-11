import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: a t719 (cópia antiga da t729) ainda cobrava o aviso "Informar o tipo de entrada" em anúncio publicado,
// que o E508 tirou de Meus imóveis. A t719 passa a cobrar o mesmo que a t729.
const spec = readFileSync("tests/e2e/specs/t719-p0-pendencia-no-assistente.spec.ts", "utf8");
test("t719 B: anúncio publicado não tem aviso nem link de tipo de entrada (E508)", () => {
  assert.doesNotMatch(spec, /aviso-tipo-entrada"\)\)\.toBeVisible/);
  assert.match(spec, /aviso-tipo-entrada"\)\)\.toHaveCount\(0\)/);
  assert.match(spec, /card-tipo-entrada"\)\)\.toHaveCount\(0\)/);
});
test("a página de Meus imóveis não tem o aviso (a regra que a spec cobra)", () => {
  assert.doesNotMatch(readFileSync("src/app/(dashboard)/dashboard/imoveis/page.tsx", "utf8"), /aviso-tipo-entrada/);
});
