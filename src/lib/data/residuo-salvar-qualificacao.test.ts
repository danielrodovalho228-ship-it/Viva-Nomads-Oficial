import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: a última qualificação ilegível nunca põe o mesmo documento duas vezes na fila. */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function saveQualification(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("saveQualification: erro ao ler a última qualificação para antes de decidir o documento", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroUltimo) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("documentoNoSalvar("));
});
