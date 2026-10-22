/*
  Etapas do editor de anúncio (Prompt 43: Anunciar em 6 passos, sobre as 5 etapas do prompt 10) + bug 13 da L2 (retomar o rascunho não trava as etapas já
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
import { ETAPA } from "./anuncio/etapas-ids.ts";

test("6 passos, nesta ordem: endereço, tipo e quartos, fotos, comodidades, regras e valores, revisar", () => {
  assert.deepEqual([...ETAPAS], ["onde", "espaco", "fotos", "comodidades", "regras", "revisar"]);
  assert.deepEqual([...ORDEM_ETAPAS], [0, 1, 2, 3, 4, 5]);
  for (const [nome, id] of Object.entries(ETAPA)) assert.equal(ETAPAS[id], nome, "ETAPA e ETAPAS concordam");
});

test("etapa já visitada fica liberada mesmo depois de voltar", () => {
  const max = etapaMaisAvancada(0, 3); // chegou até Preço
  assert.equal(etapaLiberada(3, 1, max), true); // voltou às Fotos: Preço segue clicável
  assert.equal(etapaLiberada(4, 1, max), false); // etapa nunca visitada: só pelo "Continuar"
  assert.equal(etapaLiberada(0, 1, max), true);
});

test("rascunho guarda a etapa mais avançada; antigos usam a etapa atual", () => {
  assert.equal(etapaMaxDoRascunho({ step: 1, etapaMax: 3 }, 4), 3);
  assert.equal(etapaMaxDoRascunho({ step: 2, etapaMax: 99 }, 5), 5);
  assert.equal(etapaMaxDoRascunho({ etapaMax: "x" }, 4), 0);
});

test("posição e etapa são inversas; valores fora do intervalo são limitados", () => {
  for (let p = 0; p < ORDEM_ETAPAS.length; p++) assert.equal(posicaoDaEtapa(etapaNaPosicao(p)), p);
  assert.equal(etapaNaPosicao(-3), 0);
  assert.equal(etapaNaPosicao(99), 5);
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
  assert.equal(primeiraEtapaIncompleta({}), ETAPA.onde);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, areaM2: "" }), ETAPA.espaco);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, photos: FOTOS_8.slice(0, 7) }), ETAPA.fotos);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, title: "" }), ETAPA.comodidades);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, garantias: { caucao_avista: false } }), ETAPA.regras);
  assert.equal(primeiraEtapaIncompleta(COMPLETO), ETAPA.revisar);
  // Ordem antiga (versão 2, "fotos primeiro", step 3 = Fotos): ignora o step e procura o que falta.
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 2, title: "" }), ETAPA.comodidades);
  assert.equal(posMaxDoRascunho({ ...COMPLETO, step: 6, etapaMax: 6, ordemEtapas: 2, monthlyPrice: "" }), ETAPA.regras);
});

test("rascunho das 5 etapas (versão 3) reabre na mesma etapa dentro dos 6 passos", () => {
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 0, ordemEtapas: 3 }), ETAPA.onde);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 1, ordemEtapas: 3 }), ETAPA.fotos);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 2, ordemEtapas: 3 }), ETAPA.espaco);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 3 }), ETAPA.regras);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 4, ordemEtapas: 3 }), ETAPA.revisar);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 9, ordemEtapas: 3, title: "" }), ETAPA.comodidades);
});

test("nenhum campo do rascunho se perde na troca de 5 para 6 passos: só a etapa muda", () => {
  const antes = { ...COMPLETO, step: 2, ordemEtapas: 3, etapaMax: 3, extra: { pets: true } };
  const copia = structuredClone(antes);
  etapaDoRascunho(antes);
  posMaxDoRascunho(antes);
  assert.deepEqual(antes, copia, "ler a etapa não altera o rascunho");
});

test("rascunho da ordem atual mantém a etapa e a mais avançada", () => {
  assert.equal(etapaDoRascunho({ step: 2, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 2);
  assert.equal(etapaDoRascunho({ step: 9, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 0);
  assert.equal(posMaxDoRascunho({ step: 1, etapaMax: 3, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 3);
  assert.equal(posMaxDoRascunho({ step: 4, etapaMax: 1, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 4);
});

test("etapaDaUrl: só aceita 0..5; qualquer outra coisa vira null", () => {
  assert.equal(etapaDaUrl("3"), 3);
  assert.equal(etapaDaUrl("5"), 5);
  assert.equal(etapaDaUrl("0"), 0);
  for (const v of ["6", "7", "-1", "3.5", "abc", "", null, undefined, "03"]) assert.equal(etapaDaUrl(v), null);
});
