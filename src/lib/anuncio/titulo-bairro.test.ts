/* Roda: node --test src/lib/anuncio/titulo-bairro.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bairroCitadoNoTitulo, avisoTituloBairro } from "./titulo-bairro.ts";

test("título que cita outro bairro conhecido avisa", () => {
  assert.equal(bairroCitadoNoTitulo("Studio mobiliado no Umuarama", "Santa Mônica"), "Umuarama");
  assert.match(avisoTituloBairro("Studio mobiliado no Umuarama", "Santa Mônica") ?? "", /Umuarama.*Santa Mônica/);
});

test("título com o bairro cadastrado (com ou sem acento/caixa) não avisa", () => {
  assert.equal(avisoTituloBairro("Studio em santa monica", "Santa Mônica"), null);
  assert.equal(avisoTituloBairro("Apto no Umuarama", "Umuarama"), null);
});

test("título sem bairro, ou bairro ainda vazio, não avisa", () => {
  assert.equal(avisoTituloBairro("Studio mobiliado perto da UFU", "Martins"), null);
  assert.equal(avisoTituloBairro("Studio no Umuarama", ""), null);
  assert.equal(avisoTituloBairro("", "Martins"), null);
});

test("não confunde palavra parcial (Centro x Centrolândia)", () => {
  assert.equal(avisoTituloBairro("Casa em Centrolândia", "Martins"), null);
  assert.equal(avisoTituloBairro("Studio no Centro", "Martins") !== null, true);
});

test("se cita o cadastrado e outro, não avisa (decisão do dono)", () => {
  assert.equal(avisoTituloBairro("Entre o Centro e o Martins", "Martins"), null);
});

import { avisosConsistenciaTitulo, quartosCitados } from "./titulo-bairro.ts";
test("E150 — título × tipo e quartos: avisa sem travar", () => {
  assert.equal(quartosCitados("Studio com 2 quartos vem morar aqui"), 2);
  assert.equal(quartosCitados("Apartamento de dois quartos"), 2);
  assert.equal(quartosCitados("Studio mobiliado"), null);
  const a = avisosConsistenciaTitulo("Studio com 2 quartos vem morar aqui", { bairro: "Centro", tipo: "studio", quartos: "3" });
  assert.deepEqual(a, ["O título diz 2 quartos, mas o anúncio tem 3 quartos. Confira se está certo (você pode manter)."]);
  assert.deepEqual(avisosConsistenciaTitulo("Casa ampla no Centro", { bairro: "Centro", tipo: "apartamento", quartos: 2 }), [
    "O título diz casa, mas o tipo do anúncio é apartamento. Confira se está certo (você pode manter).",
  ]);
  assert.deepEqual(avisosConsistenciaTitulo("Apartamento com 2 quartos", { bairro: "Centro", tipo: "apartamento", quartos: 2 }), []);
  assert.deepEqual(avisosConsistenciaTitulo("Casa no condomínio", { tipo: "casa_condominio", quartos: 3 }), []);
});
