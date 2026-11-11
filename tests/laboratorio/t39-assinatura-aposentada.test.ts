import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rodada completa do lab 10/11 (5eb1fad9): t39 esperava /app/boas-vindas depois de /dashboard/assinatura e recebeu
// /auth?redirect=%2Fdashboard. Desde o E563 (04/11) a página de preços está suspensa: sem NEXT_PUBLIC_PRECOS_VISIVEL=1,
// o next.config leva /dashboard/assinatura ao /dashboard, e quem não entrou vai ao login. A spec segue a mesma chave.
test("t39: o destino da assinatura aposentada acompanha a chave da página de preços (E563)", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /source: "\/dashboard\/assinatura", destination: precosVisivel \? "\/precos" : "\/dashboard"/);
  const spec = readFileSync("tests/e2e/specs/t39-app-ida-e-volta.spec.ts", "utf8");
  assert.match(spec, /process\.env\.NEXT_PUBLIC_PRECOS_VISIVEL === "1"/);
  assert.match(spec, /precosVisivel \? \/\\\/app\\\/boas-vindas\/ : \/\\\/auth\\\?redirect=%2Fdashboard\//);
});
