import { test } from "node:test";
import assert from "node:assert/strict";
import { aguardaAceiteOrdem, estadoDaOrdem, podeAceitarOrdem } from "./central.ts";
import { LIMITE_ORDEM, textoReaberto, validarReabertura } from "./aceite-ordem.ts";

// Ordem 3c3d8a9e, parte 2: ordem criada por pessoa só é "feita" quando quem pediu aceita.
const daniel = "11111111-1111-1111-1111-111111111111";
const outro = "22222222-2222-2222-2222-222222222222";
const entregue = { status: "concluida" as const, criado_por: daniel, aceito_em: null };

test("ordem de pessoa concluída e sem aceite aguarda o aceite", () => {
  assert.equal(aguardaAceiteOrdem(entregue), true);
  assert.equal(estadoDaOrdem(entregue), "aguardando_aceite");
});

test("casos negativos: ordem de agente, já aceita, ainda aberta ou banco sem a 0209 não aguardam aceite", () => {
  assert.equal(aguardaAceiteOrdem({ status: "concluida", criado_por: null, aceito_em: null }), false); // criada por agente
  assert.equal(aguardaAceiteOrdem({ ...entregue, aceito_em: "2026-10-22T10:00:00Z" }), false);
  assert.equal(aguardaAceiteOrdem({ ...entregue, status: "pendente" as never }), false);
  assert.equal(aguardaAceiteOrdem({ status: "concluida", criado_por: daniel }), false); // coluna ausente
  assert.equal(estadoDaOrdem({ status: "concluida" }), "concluida");
});

test("só quem criou a ordem aceita ou reabre", () => {
  assert.equal(podeAceitarOrdem(entregue, daniel), true);
  assert.equal(podeAceitarOrdem(entregue, outro), false);
  assert.equal(podeAceitarOrdem(entregue, null), false);
  assert.equal(podeAceitarOrdem({ ...entregue, aceito_em: "2026-10-22T10:00:00Z" }, daniel), false);
});

test("reabrir exige o que falta e respeita o limite", () => {
  assert.equal(validarReabertura("   ").ok, false);
  assert.equal(validarReabertura(undefined).ok, false);
  assert.equal(validarReabertura("x".repeat(1001)).ok, false);
  assert.deepEqual(validarReabertura("  Faltou o print.  "), { ok: true, falta: "Faltou o print." });
});

test("texto reaberto mantém o que falta inteiro e cabe nos 4000 do banco", () => {
  assert.match(textoReaberto("Corrigir a tela.", "Faltou o print."), /^Corrigir a tela\.\n\nREABERTA por quem pediu — o que falta: Faltou o print\.$/);
  const longo = textoReaberto("a".repeat(LIMITE_ORDEM), "b".repeat(1000));
  assert.ok(longo.length <= LIMITE_ORDEM);
  assert.ok(longo.endsWith("b".repeat(1000)));
});
