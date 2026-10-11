/*
  Bug 13 da L2 — retomar o rascunho não trava as etapas já visitadas.
  Roda: node --test src/lib/etapas-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { etapaLiberada, etapaMaisAvancada, etapaMaxDoRascunho } from "./etapas-anuncio.ts";

test("etapa já visitada fica liberada mesmo depois de voltar", () => {
  const max = etapaMaisAvancada(0, 4); // chegou até Comodidades
  assert.equal(etapaLiberada(4, 1, max), true); // voltou ao Endereço: Comodidades segue clicável
  assert.equal(etapaLiberada(5, 1, max), false); // etapa nunca visitada: só pelo "Continuar"
  assert.equal(etapaLiberada(0, 1, max), true);
});

test("rascunho guarda a etapa mais avançada; antigos usam a etapa atual", () => {
  assert.equal(etapaMaxDoRascunho({ step: 1, etapaMax: 4 }, 6), 4);
  assert.equal(etapaMaxDoRascunho({ step: 3 }, 6), 3);
  assert.equal(etapaMaxDoRascunho({ step: 2, etapaMax: 99 }, 6), 6);
  assert.equal(etapaMaxDoRascunho({ etapaMax: "x" }, 6), 0);
});

import { ORDEM_ETAPAS, posicaoDaEtapa, etapaNaPosicao, etapaDoRascunho, posMaxDoRascunho, VERSAO_ORDEM_ETAPAS } from "./etapas-anuncio.ts";

test("fotos primeiro: a ordem começa nas fotos e termina na revisão", () => {
  assert.equal(ORDEM_ETAPAS[0], 3);
  assert.equal(ORDEM_ETAPAS[ORDEM_ETAPAS.length - 1], 6);
  assert.deepEqual([...ORDEM_ETAPAS].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test("posição e etapa são inversas; valores fora do intervalo são limitados", () => {
  for (let p = 0; p < ORDEM_ETAPAS.length; p++) assert.equal(posicaoDaEtapa(etapaNaPosicao(p)), p);
  assert.equal(etapaNaPosicao(-3), 3);
  assert.equal(etapaNaPosicao(99), 6);
  assert.equal(etapaNaPosicao(Number.NaN), 3);
  assert.equal(posicaoDaEtapa(42), 0);
});

test("rascunho: etapa inválida cai nas fotos; válida é mantida", () => {
  assert.equal(etapaDoRascunho({ step: "x" }), 3);
  assert.equal(etapaDoRascunho({ step: 9 }), 3);
  assert.equal(etapaDoRascunho({ step: 1 }), 1);
});

test("rascunho antigo (ids em sequência) vira a posição mais avançada na ordem nova", () => {
  // Já tinha chegado ao Endereço (id 1) passando por Tipo (0): posições de 0 e 1 = 1 e 4.
  assert.equal(posMaxDoRascunho({ step: 0, etapaMax: 1 }), 4);
  // Chegou à Revisão (id 6): última posição.
  assert.equal(posMaxDoRascunho({ step: 6, etapaMax: 6 }), 6);
  // Rascunho vazio: começa nas fotos (posição 0).
  assert.equal(posMaxDoRascunho({}), 0);
});

test("rascunho novo guarda a posição direto", () => {
  assert.equal(posMaxDoRascunho({ step: 3, etapaMax: 2, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 2);
  assert.equal(posMaxDoRascunho({ step: 6, etapaMax: 1, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 6);
});
