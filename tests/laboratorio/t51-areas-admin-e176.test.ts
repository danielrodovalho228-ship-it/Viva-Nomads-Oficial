import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: a inicial do admin não repete "Áreas do admin" (guardado em estilo-admin.test); o t51 não pode exigi-lo.
test("t51 não exige o painel 'Áreas do admin' na inicial", () => {
  const spec = readFileSync("tests/e2e/specs/t51-admin-padrao-caixa-socios.spec.ts", "utf8");
  assert.doesNotMatch(spec, /name: "Áreas do admin"/);
  const menu = readFileSync("src/config/menu-admin.ts", "utf8");
  for (const h of ["/admin/socios", "/admin/parceiros", "/admin/agentes"]) assert.ok(menu.includes(`"${h}"`), h);
  assert.match(readFileSync("src/lib/estilo/estilo-admin.test.ts", "utf8"), /<AtalhosAdmin/);
});
