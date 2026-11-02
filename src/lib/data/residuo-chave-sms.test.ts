import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: verificação ilegível nunca manda "confirme o telefone" a quem já confirmou. */
const fonte = readFileSync(new URL("./pedidos-admin.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function definirChaveSms(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("definirChaveSms: erro ao ler a confirmação pula o inquilino antes do aviso", () => {
  assert.ok(i >= 0);
  assert.match(f, /\{ data: u, error: erroU \}, \{ data: tv, error: erroTv \}/);
  const g = f.indexOf("if (erroU || erroTv) continue;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("telefoneConfirmado("), "antes de decidir");
  assert.ok(g < f.indexOf('event: "pedido_confirmar_telefone"'), "antes do aviso");
});
