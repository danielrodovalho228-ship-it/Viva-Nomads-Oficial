import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o t51 não pode exigir o que o E176/ADMIN-2 tirou: o painel "Áreas do admin" na inicial e a tela própria de /admin/fotografos.
test("t51 não exige 'Áreas do admin' nem a tela própria de fotógrafos", () => {
  const spec = readFileSync("tests/e2e/specs/t51-admin-padrao-caixa-socios.spec.ts", "utf8");
  assert.doesNotMatch(spec, /name: "Áreas do admin"/);
  assert.doesNotMatch(spec, /titulo: "Fotógrafos parceiros"/);
  assert.match(readFileSync("src/lib/estilo/estilo-admin.test.ts", "utf8"), /<AtalhosAdmin/);
  assert.match(readFileSync("src/config/menu-admin.ts", "utf8"), /"\/admin\/fotografos": "redireciona para a aba 'Fotógrafos' de Parceiros/);
});
