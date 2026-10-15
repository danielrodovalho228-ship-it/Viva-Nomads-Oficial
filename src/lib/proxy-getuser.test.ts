import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 0f66a754: nenhum getUser no proxy sem antes checar o cookie de sessão.
const fonte = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("proxy: todo getUser vem depois da checagem do cookie de sessão", () => {
  const chamadas = [...fonte.matchAll(/auth\.getUser\(\)/g)].map((m) => m.index!);
  assert.equal(chamadas.length, 2, "no máximo 2 pontos com getUser (papelDoApp e o proxy)");
  for (const i of chamadas) {
    const antes = fonte.slice(Math.max(0, i - 900), i);
    assert.match(antes, /precisaVerificarUsuario\(request\.cookies\.getAll\(\)\)/, "getUser sem guarda de cookie");
  }
});
