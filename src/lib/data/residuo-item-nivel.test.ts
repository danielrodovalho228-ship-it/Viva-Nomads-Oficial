import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: item ilegível nunca apaga a foto da câmera já guardada. */
const fonte = readFileSync(new URL("./nivel-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function salvarItemNivel(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("salvarItemNivel: erro ao ler o item para antes do upsert", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroAtual) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf('from("nivel_itens").upsert('));
});
