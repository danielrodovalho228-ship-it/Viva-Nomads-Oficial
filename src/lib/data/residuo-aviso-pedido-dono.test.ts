import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: perfil ilegível nunca grava "sem e-mail" para sempre no aviso de pedido compatível. */
const fonte = readFileSync(new URL("./pedidos-compat.ts", import.meta.url), "utf8");
const i = fonte.indexOf("async function avisarDono(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("avisarDono: erro ao ler o perfil sai antes de gravar pedido_avisos", () => {
  assert.ok(i >= 0);
  const g = f.indexOf('if (erroPerfil) return "nenhum";');
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf('motivoNaoEnvio = "sem_email"'), "antes de concluir 'sem e-mail'");
  assert.ok(g < f.indexOf('.from("pedido_avisos")'), "antes do insert");
});
