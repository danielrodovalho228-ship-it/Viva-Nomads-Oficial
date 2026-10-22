/*
  Cidade sem duplicata por grafia.
  Roda: node --test src/lib/cidades.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveCidade, acharCidade, mesmaCidade, tituloContagemCidade } from "./cidades.ts";

const MG = ["Belo Horizonte", "Uberaba", "Uberlândia", "São João del Rei"];

test("grafias diferentes da mesma cidade têm a mesma chave", () => {
  assert.equal(chaveCidade("Uberlândia"), chaveCidade("uberlandia"));
  assert.equal(chaveCidade("  SÃO  João del-Rei "), "sao joao del-rei");
  assert.ok(mesmaCidade("Uberlandia", "UBERLÂNDIA"));
  assert.ok(!mesmaCidade("Uberaba", "Uberlândia"));
  assert.ok(!mesmaCidade("", ""));
});

test("acharCidade devolve o nome oficial com acento", () => {
  assert.equal(acharCidade(MG, "uberlandia"), "Uberlândia");
  assert.equal(acharCidade(MG, "Sao Joao del Rei"), "São João del Rei");
  assert.equal(acharCidade(MG, "Uberlandiaa"), null);
  assert.equal(acharCidade(undefined, "Uberlândia"), null);
});

test("tituloContagemCidade: reais e exemplos não se somam", () => {
  assert.equal(tituloContagemCidade(1, 15, "Uberlândia"), "1 imóvel + 15 de exemplo em Uberlândia");
  assert.equal(tituloContagemCidade(3, 0, "Uberlândia"), "3 imóveis em Uberlândia");
  assert.equal(tituloContagemCidade(0, 15, "Uberlândia"), "15 anúncios de exemplo em Uberlândia");
  assert.equal(tituloContagemCidade(0, 0, "Uberlândia"), "Ainda não há imóveis em Uberlândia");
});
