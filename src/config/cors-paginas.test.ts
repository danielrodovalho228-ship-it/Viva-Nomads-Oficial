import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem a4a13765 (#126): páginas HTML e /api/comissao não podem responder "Access-Control-Allow-Origin: *".
const fonte = readFileSync("next.config.ts", "utf8");

test("regra de CORS cobre páginas e APIs (menos _next) com a origem do site, nunca *", () => {
  const m = fonte.match(/source:\s*"(\/\(\(\?!_next\/\)\.\*\))",\s*headers:\s*\[([\s\S]*?)\],\s*\}/);
  assert.ok(m, "regra de CORS para todas as rotas fora de _next não encontrada");
  assert.match(m[2], /"Access-Control-Allow-Origin",\s*value:\s*"https:\/\/vivanomads\.com\.br"/);
  const re = new RegExp(`^${m[1]}$`);
  for (const rota of ["/", "/precos", "/como-funciona", "/para-proprietarios", "/empresas", "/api/comissao"]) {
    assert.ok(re.test(rota), `${rota} deve ser coberta`);
  }
  assert.ok(!re.test("/_next/static/x.js"));
});

test("nenhuma regra manda Access-Control-Allow-Origin: *", () => {
  assert.doesNotMatch(fonte, /Access-Control-Allow-Origin",\s*value:\s*"\*"/);
});

test("a regra de CORS vem depois da global (a última vence)", () => {
  assert.ok(fonte.indexOf('source: "/((?!_next/).*)"') > fonte.indexOf('source: "/:path*"'));
});
