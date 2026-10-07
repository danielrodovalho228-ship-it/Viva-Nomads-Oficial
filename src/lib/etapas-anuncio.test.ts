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
