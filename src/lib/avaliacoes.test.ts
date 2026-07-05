/*
  Testes da reputação (avaliação bidirecional).
  Roda: node --experimental-strip-types --test src/lib/avaliacoes.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mediaAvaliacoes,
  reputacaoLabel,
  validarAvaliacao,
  papelOposto,
} from "./avaliacoes.ts";

test("1: média simples", () => {
  assert.equal(mediaAvaliacoes([5, 4, 3]), 4);
});
test("2: média arredonda 1 casa", () => {
  assert.equal(mediaAvaliacoes([5, 4]), 4.5);
  assert.equal(mediaAvaliacoes([5, 4, 4]), 4.3);
});
test("3: lista vazia = 0", () => {
  assert.equal(mediaAvaliacoes([]), 0);
});
test("4: ignora notas fora de 1..5", () => {
  assert.equal(mediaAvaliacoes([5, 0, 6, 4]), 4.5);
});
test("5: label sem avaliações", () => {
  assert.equal(reputacaoLabel(0, 0), "Sem avaliações ainda");
});
test("6: label excelente/ótimo/bom", () => {
  assert.match(reputacaoLabel(4.8, 10), /Excelente/);
  assert.match(reputacaoLabel(4.1, 3), /Ótimo/);
  assert.match(reputacaoLabel(3.2, 2), /Bom/);
});
test("7: label singular/plural", () => {
  assert.match(reputacaoLabel(4.6, 1), /1 avaliação/);
  assert.match(reputacaoLabel(4.6, 5), /5 avaliações/);
});
test("8: validar rating fora de faixa", () => {
  assert.ok(validarAvaliacao(0));
  assert.ok(validarAvaliacao(6));
  assert.equal(validarAvaliacao(4), null);
});
test("9: validar comentário longo", () => {
  assert.ok(validarAvaliacao(5, "x".repeat(1001)));
  assert.equal(validarAvaliacao(5, "ótimo"), null);
});
test("10: papel oposto", () => {
  assert.equal(papelOposto("proprietario"), "inquilino");
  assert.equal(papelOposto("inquilino"), "proprietario");
});
