import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: dedup ilegível nunca duplica as ordens de erro técnico. */
const fonte = readFileSync(new URL("./viva-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("async function encaminharErroTecnico(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("encaminharErroTecnico: erro na contagem sai antes de criar ordens", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroJa || (count ?? 0) > 0) return;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf('from("agentes_ordens").insert('));
});
