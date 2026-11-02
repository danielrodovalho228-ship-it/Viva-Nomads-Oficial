/** E445 item 6 — som de mensagem nova — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveTocarSom, somLigadoDe, valorDoSom } from "./som-mensagem.ts";
import { normalizarContadores } from "./contadores.ts";

test("a 1ª leitura (ao abrir o site) nunca toca", () => {
  assert.equal(deveTocarSom(null, 3, true), false);
});

test("toca só quando as não lidas SOBEM", () => {
  assert.equal(deveTocarSom(2, 3, true), true);
  assert.equal(deveTocarSom(3, 3, true), false);
  assert.equal(deveTocarSom(3, 1, true), false);
});

test("desligado: nunca toca", () => {
  assert.equal(deveTocarSom(0, 5, false), false);
});

test("preferência do aparelho: ligado por padrão, '0' desliga", () => {
  assert.equal(somLigadoDe(null), true);
  assert.equal(somLigadoDe(undefined), true);
  assert.equal(somLigadoDe("1"), true);
  assert.equal(somLigadoDe("0"), false);
  assert.equal(somLigadoDe(valorDoSom(false)), false);
  assert.equal(somLigadoDe(valorDoSom(true)), true);
});

test("contadores: mensagensRecebidas normalizada (ausente/negativa = 0)", () => {
  assert.equal(normalizarContadores({}).mensagensRecebidas, 0);
  assert.equal(normalizarContadores({ mensagensRecebidas: -2 }).mensagensRecebidas, 0);
  assert.equal(normalizarContadores({ mensagensRecebidas: 4 }).mensagensRecebidas, 4);
});
