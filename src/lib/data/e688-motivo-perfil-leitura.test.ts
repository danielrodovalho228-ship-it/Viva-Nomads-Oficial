/*
  Varredura "leitura que falha não vira não encontrado": na candidatura sem motivo escolhido, o motivo vem do perfil.
  Se a leitura do perfil falha, a candidatura NÃO segue sem motivo (o dono veria "motivo não informado" por um erro nosso):
  devolve a mensagem de "tente de novo", como as outras leituras do mesmo fluxo. Perfil sem motivo (sem erro) segue normal.
  Roda: node --test src/lib/data/e688-motivo-perfil-leitura.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("a leitura do motivo no perfil confere o erro e recusa com a mensagem de tentar de novo", () => {
  const i = src.indexOf('.from("profiles").select("motivo_estadia")');
  assert.ok(i > 0, "a leitura do motivo no perfil existe");
  const trecho = src.slice(i - 80, i + 500);
  assert.match(trecho, /const \{ data: perfil, error: erroPerfil \}/);
  assert.match(trecho, /if \(erroPerfil\) return \{ ok: false, error: MSG_CONTATO_SEM_LEITURA \};/);
});
