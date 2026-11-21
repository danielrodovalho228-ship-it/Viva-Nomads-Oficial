import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 178 (varredura "leitura que falha não vira outra resposta"): na candidatura sem motivo escolhido, o motivo vem
 * do perfil. Se a leitura do perfil falha, a candidatura NÃO pode seguir sem motivo em silêncio: para antes de gravar.
 */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function requestLead(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("requestLead: leitura do motivo no perfil com erro para antes de gravar o lead", () => {
  const leitura = f.indexOf('.from("profiles").select("motivo_estadia")');
  assert.ok(leitura >= 0);
  const trecho = f.slice(Math.max(0, leitura - 80), leitura + 400);
  assert.match(trecho, /error: erroPerfil/);
  const g = f.indexOf("if (erroPerfil) return { ok: false, error: MSG_CONTATO_SEM_LEITURA };");
  assert.ok(g > leitura);
  assert.ok(g < f.indexOf("camposDaCandidatura({"));
  assert.ok(g < f.indexOf('.from("leads")\n        .insert('));
});
