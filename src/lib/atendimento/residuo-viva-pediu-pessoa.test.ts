import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: falha ao contar "pediu_humano" nunca libera a resposta automática da Viva. */
const fonte = readFileSync(new URL("./viva-servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function responderNaEquipe(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("responderNaEquipe: contagem de pediu_humano com erro conta como 'pediu'", () => {
  assert.ok(i >= 0);
  assert.match(f, /const \{ count: jaPediu, error: erroPediu \} = await admin\.from\("chamado_eventos"\)/);
  assert.match(f, /let pediuPessoa = erroPediu \? true : \(jaPediu \?\? 0\) > 0;/);
  // Com pediuPessoa, o motivo para aprovação existe e a Viva não responde sozinha.
  assert.match(f, /const motivo = pediuPessoa \? "pediu para falar com uma pessoa"/);
  assert.match(f, /const sozinha = !motivo && !!texto;/);
});
