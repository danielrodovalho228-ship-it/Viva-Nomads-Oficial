import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: qualificação anterior ilegível nunca duplica o documento na fila. */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function enviarDocumentoParaConferencia(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("enviarDocumentoParaConferencia: erro ao ler a anterior para antes do insert", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroAnterior) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("documentoJaNaFila("), "antes do dedup");
  assert.ok(g < f.indexOf('from("qualification_checklists").insert('), "antes do insert");
});
