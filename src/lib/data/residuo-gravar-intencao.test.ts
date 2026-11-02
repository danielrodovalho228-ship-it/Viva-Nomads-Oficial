import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: perfil ilegível nunca vira "primeiro acesso" (que troca papel ativo e modo). */
const fonte = readFileSync(new URL("./intencao-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function gravarIntencao(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("gravarIntencao: erro ao ler o perfil para antes de qualquer gravação", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroAntes) return { ok: false, papelAplicado: null };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("contaNoPrimeiroAcesso("), "antes de decidir o primeiro acesso");
  assert.ok(g < f.indexOf(".update({ intencao })"), "antes de gravar a intenção");
});
