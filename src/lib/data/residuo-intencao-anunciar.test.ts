import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { intencaoAoAnunciar } from "../auth/entrada.ts";

/** Resíduo da varredura ampla: intenção ilegível nunca é substituída por ["anunciar"] no 1º rascunho. */
const fonte = readFileSync(new URL("./intencao-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function registrarIntencaoDeAnunciar(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("o risco: intenção lida como null vira só ['anunciar']", () => {
  assert.deepEqual(intencaoAoAnunciar(null), ["anunciar"]);
});

test("registrarIntencaoDeAnunciar: erro de leitura sai antes de calcular e gravar", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (error) return;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("intencaoAoAnunciar("));
  assert.ok(g < f.indexOf("gravarIntencao("));
});
