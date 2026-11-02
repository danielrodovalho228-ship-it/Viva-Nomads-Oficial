import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: dedup ilegível nunca duplica o bloqueio de datas (E137). */
const fonte = readFileSync(new URL("./blocks-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function addBlock(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("addBlock: erro no dedup para antes do insert", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroIgual) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf(".insert("));
});
