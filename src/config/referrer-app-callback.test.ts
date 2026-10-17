import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t47 do lab: a rota recebia o Referrer-Policy global. A regra específica precisa vir DEPOIS da global.
const fonte = readFileSync("next.config.ts", "utf8");

test("/auth/app-callback tem regra própria de Referrer-Policy no-referrer", () => {
  assert.match(fonte, /source:\s*"\/auth\/app-callback",\s*headers:\s*\[\{\s*key:\s*"Referrer-Policy",\s*value:\s*"no-referrer"\s*\}\]/);
});

test("a regra do app-callback vem depois da regra global (a última vence)", () => {
  const global = fonte.indexOf('source: "/:path*"');
  const callback = fonte.indexOf('source: "/auth/app-callback"');
  assert.ok(global >= 0 && callback > global);
});
