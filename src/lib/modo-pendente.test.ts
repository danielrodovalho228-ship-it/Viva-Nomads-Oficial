/*
  Bug 6 da L2 — modo trocado e ainda não confirmado pelo servidor.
  Roda: node --test src/lib/modo-pendente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAVE_MODO_PENDENTE, VALIDADE_PENDENTE_MS, decidirModoInicial, gravarPendente, lerPendente, limparPendente } from "./modo-pendente.ts";

function armazem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test("troca recente ainda não confirmada vence o servidor e é regravada", () => {
  const s = armazem();
  gravarPendente(s, "tenant", 1_000);
  const p = lerPendente(s, 1_000 + 5_000);
  assert.deepEqual(decidirModoInicial("owner", p), { modo: "tenant", regravar: true });
});

test("servidor já confirmou (mesmo modo): nada a regravar", () => {
  assert.deepEqual(decidirModoInicial("tenant", { modo: "tenant", em: 0 }), { modo: "tenant", regravar: false });
  assert.deepEqual(decidirModoInicial("owner", null), { modo: "owner", regravar: false });
  assert.deepEqual(decidirModoInicial(null, null), { modo: null, regravar: false });
});

test("anotação velha (mais de 10 min) ou inválida não vale", () => {
  const s = armazem();
  gravarPendente(s, "tenant", 0);
  assert.equal(lerPendente(s, VALIDADE_PENDENTE_MS + 1), null);
  s.setItem(CHAVE_MODO_PENDENTE, '{"modo":"admin","em":0}');
  assert.equal(lerPendente(s, 0), null);
  s.setItem(CHAVE_MODO_PENDENTE, "não é json");
  assert.equal(lerPendente(s, 0), null);
});

test("limpar só apaga se a anotação ainda é do mesmo modo", () => {
  const s = armazem();
  gravarPendente(s, "owner", 0);
  limparPendente(s, "tenant"); // confirmação de uma troca anterior não apaga a nova
  assert.equal(lerPendente(s, 0)?.modo, "owner");
  limparPendente(s, "owner");
  assert.equal(lerPendente(s, 0), null);
});

test("chave com prefixo vivanomads- (o signOut apaga junto)", () => {
  assert.match(CHAVE_MODO_PENDENTE, /^vivanomads-/);
});

test("sem armazenamento (modo privado) não quebra", () => {
  gravarPendente(null, "owner");
  assert.equal(lerPendente(null), null);
  limparPendente(null);
});
