import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: tipo anterior ilegível nunca grava "individual" errado na trilha de auditoria. */
const fonte = readFileSync(new URL("./planos-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function definirAccountType(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("definirAccountType: erro ao ler o tipo atual para antes do update e da auditoria", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroAntes) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf(".update({ account_type: novoTipo })"));
  assert.ok(g < f.indexOf('from("account_type_audit").insert('));
});
