import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: contagem ilegível nunca fura o limite em salvarServico. */
const fonte = readFileSync(new URL("./painel-actions.ts", import.meta.url), "utf8");
const i = fonte.search(/(export )?async function salvarServico\(/);
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("salvarServico: erro na contagem devolve 'tente de novo' antes do limite e da gravação", () => {
  assert.ok(i >= 0);
  assert.match(f, /const \{ count, error: erroContagem \} = await/);
  const g = f.indexOf("if (erroContagem) return { ok: false, erro: \"Não foi possível conferir o limite agora. Tente de novo.\" };");
  assert.ok(g >= 0, "guarda da contagem");
  const teto = f.search(/\(count \?\? 0\)|tetoAtingido\(count/);
  assert.ok(g < teto, "antes do limite");
});
