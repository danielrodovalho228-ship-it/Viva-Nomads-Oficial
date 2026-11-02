import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: respostas ilegíveis nunca liberam o padrão mínimo depois da resposta do morador. */
const fonte = readFileSync(new URL("./conferencia-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function responderConfortoEntrada(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("responderConfortoEntrada: erro ao ler as respostas para antes de gravar", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroRespostas) return erro(");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("podeEditarItens("), "antes da regra de edição");
  assert.ok(g < f.indexOf('from("conferencia_conforto").insert('), "antes do insert");
});
