import { test } from "node:test";
import assert from "node:assert/strict";
import { abaDoEndereco, filtroDoEndereco } from "./painel-avaliacoes.ts";

/*
  E918 (prova ao vivo do Gerente, 14/11): em /dashboard/avaliacoes?tab=recebidas a URL mudava, mas "Para avaliar" seguia
  ativa — a página só lia `?aba=`. `?tab=` (o nome comum do parâmetro de aba) vale igual; `?aba=` continua mandando quando
  os dois vêm. Os filtros antigos de "Recebidas" (todas/recentes/positivas) também chegam por `?tab=`.
*/
test("?tab=recebidas ativa Recebidas (e as outras abas também por ?tab=)", () => {
  assert.equal(abaDoEndereco({ tab: "recebidas" }), "recebidas");
  assert.equal(abaDoEndereco({ tab: "feitas" }), "feitas");
  assert.equal(abaDoEndereco({ tab: "para-avaliar" }), "para-avaliar");
  assert.equal(abaDoEndereco({ tab: "positivas" }), "recebidas");
});

test("?aba= continua valendo e manda quando os dois vêm", () => {
  assert.equal(abaDoEndereco({ aba: "recebidas" }), "recebidas");
  assert.equal(abaDoEndereco({ aba: "feitas", tab: "recebidas" }), "feitas");
});

test("sem aba (ou inválida) fica em Para avaliar", () => {
  assert.equal(abaDoEndereco({}), "para-avaliar");
  assert.equal(abaDoEndereco({ tab: "xyz" }), "para-avaliar");
});

test("filtro de Recebidas: ?filtro= ou o valor antigo em ?aba=/?tab=; senão Todas", () => {
  assert.equal(filtroDoEndereco({ filtro: "recentes" }), "recentes");
  assert.equal(filtroDoEndereco({ aba: "positivas" }), "positivas");
  assert.equal(filtroDoEndereco({ tab: "positivas" }), "positivas");
  assert.equal(filtroDoEndereco({ tab: "recebidas" }), "todas");
  assert.equal(filtroDoEndereco({}), "todas");
});
