import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem de lab verde: o t294 esperava que o não-admin fosse mandado para fora de /admin, mas o proxy
// reescreve para a página 404 e a URL continua /admin. O spec confere o status 404, não o caminho.
const proxy = readFileSync("src/proxy.ts", "utf8");
const spec = readFileSync("tests/e2e/specs/t294-seguranca-proxy-60.spec.ts", "utf8");

test("proxy: não-admin recebe rewrite com status 404 (URL não muda)", () => {
  assert.match(proxy, /Não-admin: 404/);
  assert.match(proxy, /NextResponse\.rewrite\(notFoundUrl, \{ status: 404 \}\)/);
});

test("t294: morador logado em /admin confere o status 404, não o caminho da URL", () => {
  assert.match(spec, /page\.goto\("\/admin"\)/);
  assert.match(spec, /resp\?\.status\(\)\)\.toBe\(404\)/);
  assert.doesNotMatch(spec, /pathname\)\.not\.toMatch\(\/\^\\\/admin\/\)/);
});
