/*
  E952 T1 — referenciaDaBusca: o ponto público do anúncio só vale para o MESMO endereço; endereço novo → ponto do
  endereço novo. Roda: node --test src/lib/proximidades/e952-referencia-da-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mesmoEnderecoDaBusca, referenciaDaBusca } from "./referencia.ts";

const PUBLICO = { lat: -18.918, lng: -48.258 }; // ponto gravado (endereço antigo, Umuarama)
const NOVO = { lat: -18.9456, lng: -48.3245 }; // ponto do endereço novo (Jardim Europa)
const salvo = { cep: "38402-288", rua: "Rua Antiga" };

test("T1: CEP igual ao salvo → ponto público", () => {
  assert.deepEqual(referenciaDaBusca({ salvo, pedido: { cep: "38402288" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), PUBLICO);
  assert.deepEqual(referenciaDaBusca({ salvo, pedido: { cep: "38402-288", rua: "rua antiga" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), PUBLICO);
});

test("T1: CEP diferente → ponto do endereço novo (inclusive sem ponto novo: nunca o velho)", () => {
  assert.deepEqual(referenciaDaBusca({ salvo, pedido: { cep: "38414-536", rua: "Rua Antiga" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), NOVO);
  assert.equal(referenciaDaBusca({ salvo, pedido: { cep: "38414-536" }, pontoPublico: PUBLICO, pontoEndereco: null }), null);
});

test("T1: rua diferente com o mesmo CEP → ponto do endereço novo", () => {
  assert.deepEqual(referenciaDaBusca({ salvo, pedido: { cep: "38402-288", rua: "Avenida Nova" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), NOVO);
  // Rua pedida e endereço salvo sem rua: não se confirma.
  assert.deepEqual(referenciaDaBusca({ salvo: { cep: "38402-288", rua: "" }, pedido: { cep: "38402-288", rua: "Rua Antiga" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), NOVO);
});

test("T1: anúncio novo, sem salvo → ponto do endereço", () => {
  assert.deepEqual(referenciaDaBusca({ salvo: null, pedido: { cep: "38414-536" }, pontoPublico: null, pontoEndereco: NOVO }), NOVO);
  // Salvo sem CEP guardado (anúncio antigo): o ponto público não se confirma.
  assert.deepEqual(referenciaDaBusca({ salvo: { cep: null }, pedido: { cep: "38402-288" }, pontoPublico: PUBLICO, pontoEndereco: NOVO }), NOVO);
});

test("mesmo endereço: acento, caixa e pontuação da rua não contam", () => {
  assert.ok(mesmoEnderecoDaBusca({ cep: "38402-288", rua: "Rua São José" }, { cep: "38402288", rua: "rua sao  jose" }));
  assert.ok(!mesmoEnderecoDaBusca({ cep: "38402-28", rua: "" }, { cep: "38402-28" }), "CEP incompleto nunca confirma");
});
