import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// No lab o /dashboard demora a disparar o evento "load" (imagens e vídeo do painel); o login só precisa da URL.
const SPECS = [
  "t204-cadastro-ia-real",
  "t209-jornada-dois-lados",
  "t31-cadastro-documento",
  "t33-documentos-inquilino",
  "t34-jornada-dono-planos",
  "t32-autorizacao-preconferencia",
];

for (const spec of SPECS) {
  test(`${spec}: o login espera só a URL do painel, não o evento load`, () => {
    const src = readFileSync(`tests/e2e/specs/${spec}.spec.ts`, "utf8");
    const esperas = src.match(/waitForURL\(\/\\\/dashboard\/,[^)]*\)/g) ?? [];
    assert.ok(esperas.length > 0, "sem espera do painel no login");
    for (const e of esperas) assert.match(e, /waitUntil: "commit"/);
  });
}

test("t183: sem h1 em 15 s, recarrega a rota uma vez antes de reprovar", () => {
  const src = readFileSync("tests/e2e/specs/t183-telas-logadas-390.spec.ts", "utf8");
  assert.match(src, /page\.reload\(\{ waitUntil: "domcontentloaded" \}\)/);
});
