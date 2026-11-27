/*
  E952 T2 — aplicarRespostaPerto (regra do cliente): a resposta substitui a lista (vazia inclusive); número velho e
  referência de outro endereço são descartados; erro deixa a lista vazia com o estado de erro.
  Roda: node --test src/lib/proximidades/e952-aplicar-resposta-perto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESTADO_PERTO_INICIAL, aplicarRespostaPerto, carimboPerto, iniciarBuscaPerto, invalidarPerto, textoProcurandoPerto } from "./estado-perto.ts";
import type { LugarProximo } from "./osm.ts";

const HC: LugarProximo = { tipo: "hospital", categoria: "saude", nome: "HC-UFU", distanciaM: 1000 };
const MERCADO: LugarProximo = { tipo: "mercado", categoria: "mercado", nome: "Mercado Jardim Europa", distanciaM: 300 };
const A = { cep: "38402-288", rua: "Rua Antiga" };
const B = { cep: "38414-536", rua: "Rua Nova" };

// Lista de A na tela; o dono troca para B.
const comA = { ...iniciarBuscaPerto(ESTADO_PERTO_INICIAL, A), status: "pronto" as const, itens: [HC] };

test("T2: trocar o endereço esvazia a lista na hora e leva número novo", () => {
  const e = iniciarBuscaPerto(comA, B);
  assert.equal(e.itens, null);
  assert.equal(e.status, "carregando");
  assert.equal(e.seq, comA.seq + 1);
  assert.deepEqual(e.alvo, B);
  const inc = invalidarPerto(comA);
  assert.equal(inc.itens, null, "endereço incompleto também tira a lista velha");
});

test("T2: a resposta vazia substitui a lista", () => {
  const e = iniciarBuscaPerto(comA, B);
  const r = aplicarRespostaPerto(e, { seq: e.seq, referencia: B, itens: [], fonte: "sem_lugares" });
  assert.deepEqual(r.itens, []);
  assert.equal(r.status, "pronto");
  // E também sobre uma lista cheia, com o mesmo endereço (busca repetida).
  const cheio = aplicarRespostaPerto(e, { seq: e.seq, referencia: B, itens: [MERCADO] });
  assert.deepEqual(aplicarRespostaPerto(cheio, { seq: cheio.seq, referencia: B, itens: [] }).itens, []);
});

test("T2: resposta com número velho é descartada (corrida)", () => {
  const e = iniciarBuscaPerto(comA, B);
  const velha = aplicarRespostaPerto(e, { seq: comA.seq, referencia: A, itens: [HC] });
  assert.equal(velha, e, "estado intacto");
  assert.equal(velha.itens, null);
});

test("T2: resposta com referência de outro endereço é descartada", () => {
  const e = iniciarBuscaPerto(comA, B);
  assert.equal(aplicarRespostaPerto(e, { seq: e.seq, referencia: A, itens: [HC] }), e);
  assert.equal(aplicarRespostaPerto(e, { seq: e.seq, referencia: { cep: "38414536", rua: "Outra Rua" }, itens: [HC] }), e);
  assert.deepEqual(aplicarRespostaPerto(e, { seq: e.seq, referencia: { cep: "38414536", rua: "rua nova" }, itens: [MERCADO] }).itens, [MERCADO]);
});

test("T2: erro deixa a lista vazia com estado de erro (nunca a antiga)", () => {
  const e = iniciarBuscaPerto(comA, B);
  const r = aplicarRespostaPerto(e, { seq: e.seq, erro: true });
  assert.deepEqual(r.itens, []);
  assert.equal(r.status, "erro");
});

test("busca pelo anúncio salvo (sem CEP no formulário): aceita e o endereço usado vira o do carimbo", () => {
  const e = iniciarBuscaPerto(ESTADO_PERTO_INICIAL, null);
  const r = aplicarRespostaPerto(e, { seq: e.seq, referencia: { cep: "38414536", rua: "Rua Nova" }, itens: [MERCADO] });
  assert.deepEqual(r.alvo, { cep: "38414536", rua: "Rua Nova" });
  assert.deepEqual(r.itens, [MERCADO]);
});

test("textos: procurando e carimbo com rua e CEP", () => {
  assert.equal(textoProcurandoPerto({ cep: "38414536", rua: "Rua Nova" }), "Procurando o que tem perto de Rua Nova, CEP 38414-536…");
  assert.equal(carimboPerto(B), "Perto de: Rua Nova, CEP 38414-536");
});
