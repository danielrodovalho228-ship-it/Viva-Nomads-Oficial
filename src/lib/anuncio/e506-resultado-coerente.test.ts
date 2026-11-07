/*
  E506 (reprovado no lote 6, 06/11) — a tela de resultado da Qualificação ainda se contradizia:
   1. "Qualificação · pronta" junto de "Faltam 12 itens do essencial" e "ainda sem nível";
   2. itens já confirmados no rascunho ("Sim, tem") contados como "falta", porque o resultado só olhava as respostas
      da Qualificação e ignorava as confirmações de conforto que o rascunho já tem;
   3. a barra "Progresso do cadastro" em 0 na tela 1/5 de um rascunho já adiantado.
  Roda: node --test src/lib/anuncio/e506-resultado-coerente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { confortoDoResultado, rotuloProgressoQualificacao, fracaoDaQualificacao } from "./qualificacao-conforto.ts";

test("o rótulo só diz 'pronta' quando nada falta", () => {
  assert.equal(rotuloProgressoQualificacao(0), "Qualificação · pronta");
  assert.doesNotMatch(rotuloProgressoQualificacao(12), /pronta/);
  assert.doesNotMatch(rotuloProgressoQualificacao(1), /pronta/);
});

test("o que o rascunho já confirmou não vira 'falta' (une respostas e confirmações)", () => {
  const conf = confortoDoResultado({}, CHAVES_CONFORTO.slice(0, 3));
  assert.deepEqual(conf, CHAVES_CONFORTO.slice(0, 3));
  const todos = confortoDoResultado({}, [...CHAVES_CONFORTO]);
  assert.equal(todos.length, CHAVES_CONFORTO.length);
  assert.deepEqual(confortoDoResultado({}, ["chave_que_nao_existe"]), []);
});

test("a barra não lê 0 quando o rascunho já tem confirmações", () => {
  assert.equal(fracaoDaQualificacao({ feitas: 0, total: 14 }, 0), 0);
  assert.ok(fracaoDaQualificacao({ feitas: 0, total: 14 }, 6) > 0.4);
  assert.equal(fracaoDaQualificacao({ feitas: 7, total: 14 }, 0), 0.5);
});

test("a tela usa o rótulo coerente e as confirmações do rascunho", () => {
  const q = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", "utf8");
  assert.doesNotMatch(q, /resultado \? "Qualificação · pronta"/);
  assert.match(q, /rotuloProgressoQualificacao\(/);
  assert.match(q, /confortoDoResultado\(/);
  assert.doesNotMatch(q, /Qualificação pronta · a seguir/);
  const pg = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(pg, /confirmados=\{conf\.marcados\}/);
});
