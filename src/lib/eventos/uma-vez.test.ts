/*
  Evento uma vez por sessão (funil: iniciar_anuncio disparava várias vezes).
  Roda: node --test src/lib/eventos/uma-vez.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { primeiraVezNaSessao, type ArmazemSessao } from "./uma-vez.ts";

function armazemFalso(): ArmazemSessao {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

test("só a primeira chamada da sessão registra", () => {
  const a = armazemFalso();
  assert.equal(primeiraVezNaSessao(a, "iniciar_anuncio"), true);
  assert.equal(primeiraVezNaSessao(a, "iniciar_anuncio"), false);
  assert.equal(primeiraVezNaSessao(a, "iniciar_anuncio"), false);
});

test("tipos diferentes não se bloqueiam; sessão nova registra de novo", () => {
  const a = armazemFalso();
  assert.equal(primeiraVezNaSessao(a, "iniciar_anuncio"), true);
  assert.equal(primeiraVezNaSessao(a, "iniciar_cadastro"), true);
  assert.equal(primeiraVezNaSessao(armazemFalso(), "iniciar_anuncio"), true);
});

test("armazenamento ausente ou bloqueado não derruba o evento", () => {
  assert.equal(primeiraVezNaSessao(null, "iniciar_anuncio"), true);
  const quebrado: ArmazemSessao = {
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("bloqueado"); },
  };
  assert.equal(primeiraVezNaSessao(quebrado, "iniciar_anuncio"), true);
});
