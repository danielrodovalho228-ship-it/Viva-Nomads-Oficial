import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: "já é parceira?" ilegível nunca abre pedido de parceria para quem já é. */
const fonte = readFileSync(new URL("./solicitacao-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function enviarSolicitacao(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("enviarSolicitacao: erro na leitura do parceiro para antes do pedido", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroJaParceiro) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("if (jaParceiro)"));
  assert.ok(g < f.indexOf(".insert("), "antes de gravar o pedido");
});
