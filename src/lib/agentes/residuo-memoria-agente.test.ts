import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: contagem ilegível nunca fura o teto de memórias por agente. */
const fonte = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("async lembrar(");
const f = fonte.slice(i, fonte.indexOf("\n    },", i));

test("lembrar: erro na contagem sai antes do insert", () => {
  assert.ok(i >= 0);
  assert.match(f, /const \{ count, error \} = await supabase\.from\("agentes_memoria"\)/);
  const g = f.indexOf("if (error || (count ?? 0) + fatos.length > MAX_MEMORIAS_POR_AGENTE) return;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf(".insert("));
});
