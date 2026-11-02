import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: tentativas ilegíveis nunca zeram o contador do aviso com defeito. */
const fonte = readFileSync(new URL("./avisos-daniel-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("async falhou(");
const f = fonte.slice(i, fonte.indexOf("\n    },", i));

test("falhou: com erro na leitura, o update não regrava tentativas", () => {
  assert.ok(i >= 0);
  assert.match(f, /error: erroLeitura/);
  assert.match(f, /const tentativas = erroLeitura \? \{\} : \{ tentativas:/);
  assert.match(f, /\.\.\.tentativas \}\)/);
});
