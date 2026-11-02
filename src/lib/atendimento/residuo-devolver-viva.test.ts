import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: mensagens ilegíveis nunca devolvem o chamado à Viva com o estado errado. */
const fonte = readFileSync(new URL("./viva-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function devolverChamadoParaViva(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("devolverChamadoParaViva: erro ao ler as mensagens sai antes de mudar o chamado", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroMsgs) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("const respondeAgora ="), "antes de decidir");
  assert.ok(g < f.indexOf('.from("chamados")\n    .update('), "antes do update");
});
