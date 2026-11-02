import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: análises ilegíveis nunca mandam todas as fotos de novo ao modelo. */
const fonte = readFileSync(new URL("./deteccao-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function analisarFotosDoAnuncio(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("analisarFotosDoAnuncio: erro ao ler as análises lança (cai no catch, sem rodada)", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (error) throw new Error(`análises não lidas");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("const linhas"));
  assert.ok(f.indexOf("} catch (e) {") > g, "dentro do try");
});
