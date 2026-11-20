import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
const inicio = shell.indexOf("const exclusive = mode");
const guarda = shell.slice(inicio, shell.indexOf("}, [pathname", inicio));

test("E653: o guarda de rota não escreve modo (a URL decide; só redireciona quem não tem o papel)", () => {
  assert.ok(inicio > 0, "guarda encontrado");
  assert.doesNotMatch(guarda, /setActiveMode\(/);
  assert.doesNotMatch(guarda, /salvarModo\(/);
  assert.match(guarda, /destinoForaDoPapel\(pathname\)/);
});
