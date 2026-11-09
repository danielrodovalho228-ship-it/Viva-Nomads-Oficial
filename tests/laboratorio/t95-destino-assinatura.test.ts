import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: /dashboard/assinatura vai a /precos só com NEXT_PUBLIC_PRECOS_VISIVEL=1; sem a chave vai a /dashboard. O t95 aceita os dois.
test("t95 acompanha o redirect condicional de /dashboard/assinatura", () => {
  assert.match(readFileSync("next.config.ts", "utf8"), /source: "\/dashboard\/assinatura", destination: precosVisivel \? "\/precos" : "\/dashboard"/);
  const spec = readFileSync("tests/e2e/specs/t95-assinatura-redireciona.spec.ts", "utf8");
  assert.match(spec, /toHaveURL\(\/\\\/\(precos\|dashboard\)\$\/\)/);
});

// MENUS-5: o dono não tem menu lateral (só a área da equipe); o t95 não pode exigir o `menu-cascata` do dono.
test("t95 não exige menu lateral do dono", () => {
  const spec = readFileSync("tests/e2e/specs/t95-assinatura-redireciona.spec.ts", "utf8");
  assert.doesNotMatch(spec, /menu-cascata|Abrir menu/);
  assert.match(readFileSync("src/components/layout/dashboard-shell.tsx", "utf8"), /\{!papelTopo && \(\s*<button[\s\S]{0,200}aria-label="Abrir menu"/);
});
