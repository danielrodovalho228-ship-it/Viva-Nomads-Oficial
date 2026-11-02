import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: ronda ilegível nunca vira "não achei a ronda" com a marca de já postado. */
const fonte = readFileSync(new URL("./agentes-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function postarRetornosDoMoacir(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("postarRetornosDoMoacir: erro ao ler a ronda pula a ordem antes de postar", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroRonda) continue;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf('from("agentes_conversas").insert('));
});
