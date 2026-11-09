import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: /dashboard/assinatura vai a /precos só com NEXT_PUBLIC_PRECOS_VISIVEL=1; sem a chave vai a /dashboard. O t95 aceita os dois.
test("t95 acompanha o redirect condicional de /dashboard/assinatura", () => {
  assert.match(readFileSync("next.config.ts", "utf8"), /source: "\/dashboard\/assinatura", destination: precosVisivel \? "\/precos" : "\/dashboard"/);
  const spec = readFileSync("tests/e2e/specs/t95-assinatura-redireciona.spec.ts", "utf8");
  assert.match(spec, /toHaveURL\(\/\\\/\(precos\|dashboard\)\$\/\)/);
});
