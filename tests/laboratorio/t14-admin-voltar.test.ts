import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voltaParaAdmin } from "../../src/lib/nav-mobile.ts";

// E744: o t14 abre /admin/socios pelo endereço (a inicial não lista mais o link) e exige o Voltar ao painel.
test("t14 admin: abre a subtela pelo endereço e o Voltar leva ao painel", () => {
  const s = readFileSync("tests/e2e/specs/t14-app-mode.spec.ts", "utf8");
  assert.match(s, /goto\("\/admin\/socios"/);
  assert.doesNotMatch(s, /getByRole\("link", \{ name: \/Caixa dos Sócios\/ \}\)/);
  assert.equal(voltaParaAdmin("/admin/socios"), true);
  assert.equal(voltaParaAdmin("/admin"), false);
});
