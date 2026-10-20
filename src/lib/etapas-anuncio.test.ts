/*
  Etapas do editor de anúncio (prompt 10: 5 etapas) + bug 13 da L2 (retomar o rascunho não trava as etapas já
  visitadas). Roda: node --test src/lib/etapas-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ETAPAS,
  ORDEM_ETAPAS,
  VERSAO_ORDEM_ETAPAS,
  etapaDaUrl,
  etapaDoRascunho,
  etapaLiberada,
  etapaMaisAvancada,
  etapaMaxDoRascunho,
  etapaNaPosicao,
  posMaxDoRascunho,
  posicaoDaEtapa,
  primeiraEtapaIncompleta,
} from "./etapas-anuncio.ts";

test("5 etapas, nesta ordem: Onde fica, Fotos, O que encontramos, Preço e disponibilidade, Revisar", () => {
  assert.deepEqual([...ETAPAS], ["onde", "fotos", "encontramos", "preco", "revisar"]);
  assert.deepEqual([...ORDEM_ETAPAS], [0, 1, 2, 3, 4]);
});

test("etapa já visitada fica liberada mesmo depois de voltar", () => {
  const max = etapaMaisAvancada(0, 3); // chegou até Preço
  assert.equal(etapaLiberada(3, 1, max), true); // voltou às Fotos: Preço segue clicável
  assert.equal(etapaLiberada(4, 1, max), false); // etapa nunca visitada: só pelo "Continuar"
  assert.equal(etapaLiberada(0, 1, max), true);
});

test("rascunho guarda a etapa mais avançada; antigos usam a etapa atual", () => {
  assert.equal(etapaMaxDoRascunho({ step: 1, etapaMax: 3 }, 4), 3);
  assert.equal(etapaMaxDoRascunho({ step: 2, etapaMax: 99 }, 4), 4);
  assert.equal(etapaMaxDoRascunho({ etapaMax: "x" }, 4), 0);
});

test("posição e etapa são inversas; valores fora do intervalo são limitados", () => {
  for (let p = 0; p < ORDEM_ETAPAS.length; p++) assert.equal(posicaoDaEtapa(etapaNaPosicao(p)), p);
  assert.equal(etapaNaPosicao(-3), 0);
  assert.equal(etapaNaPosicao(99), 4);
  assert.equal(etapaNaPosicao(Number.NaN), 0);
  assert.equal(posicaoDaEtapa(42), 0);
});

const FOTOS_8 = Array.from({ length: 8 }, (_, i) => ({ url: `https://x/${i}.jpg` }));
const COMPLETO = {
  street: "Rua A, 10",
  neighborhood: "Centro",
  city: "Uberlândia",
  photos: FOTOS_8,
  bathrooms: "1",
  areaM2: "40",
  maxGuests: "2",
  title: "Studio no Centro",
  monthlyPrice: "3200",
  garantias: { caucao_avista: true },
};

test("rascunho antigo abre na PRIMEIRA etapa ainda incompleta", () => {
  assert.equal(primeiraEtapaIncompleta({}), 0);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, photos: FOTOS_8.slice(0, 7) }), 1);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, areaM2: "" }), 2);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, garantias: { caucao_avista: false } }), 3);
  assert.equal(primeiraEtapaIncompleta(COMPLETO), 4);
  // Ordem antiga (versão 2, "fotos primeiro", step 3 = Fotos): ignora o step e procura o que falta.
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 2, title: "" }), 2);
  assert.equal(posMaxDoRascunho({ ...COMPLETO, step: 6, etapaMax: 6, ordemEtapas: 2, monthlyPrice: "" }), 3);
});

test("rascunho da ordem atual mantém a etapa e a mais avançada", () => {
  assert.equal(etapaDoRascunho({ step: 2, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 2);
  assert.equal(etapaDoRascunho({ step: 9, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 0);
  assert.equal(posMaxDoRascunho({ step: 1, etapaMax: 3, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 3);
  assert.equal(posMaxDoRascunho({ step: 4, etapaMax: 1, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 4);
});

test("etapaDaUrl: só aceita 0..4; qualquer outra coisa vira null", () => {
  assert.equal(etapaDaUrl("3"), 3);
  assert.equal(etapaDaUrl("0"), 0);
  for (const v of ["5", "6", "-1", "3.5", "abc", "", null, undefined, "03"]) assert.equal(etapaDaUrl(v), null);
});
