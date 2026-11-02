import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: excluir o anúncio com leitura falha nunca deixa as fotos órfãs no bucket. */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function deleteProperty(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("deleteProperty: erro ao ler o dono ou as fotos para antes de apagar", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroDono || erroFotos) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf(".delete()"), "antes de qualquer delete");
});
