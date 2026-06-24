/*
  Testes das regras puras da caução flexível + reembolso.
  Roda com: node --experimental-strip-types --test src/lib/caucao.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calcularCaucaoSugerida,
  calcularReembolso,
  destinoValor,
  totalDescontos,
  valorParcela,
  MAX_PARCELAS,
  type DescontoReembolso,
} from "./caucao.ts";

test("caução sugerida: ~10% dos móveis quando abaixo do teto da estadia", () => {
  // móveis 20.000 → 2.000; teto 30% de 12.000 = 3.600 → vence o 2.000.
  assert.equal(calcularCaucaoSugerida(20_000, 12_000), 2_000);
});

test("caução sugerida: respeita o TETO de 30% do total da estadia", () => {
  // móveis 80.000 → 8.000, mas teto 30% de 12.000 = 3.600 → limita em 3.600.
  assert.equal(calcularCaucaoSugerida(80_000, 12_000), 3_600);
});

test("caução sugerida: nunca negativa (entradas inválidas viram 0)", () => {
  assert.equal(calcularCaucaoSugerida(-100, 10_000), 0);
  assert.equal(calcularCaucaoSugerida(10_000, -100), 0);
});

test("destino do valor NUNCA é a plataforma", () => {
  assert.equal(destinoValor("avista"), "conta_vinculada");
  assert.equal(destinoValor("parcelado"), "emissor");
});

test("valor da parcela: divide e limita ao máximo de parcelas", () => {
  assert.equal(valorParcela(1200, 12), 100);
  assert.equal(valorParcela(1000, 1), 1000);
  // acima do máximo é limitado a MAX_PARCELAS
  assert.equal(valorParcela(1200, 999), Math.round(1200 / MAX_PARCELAS));
  // mínimo de 1 parcela
  assert.equal(valorParcela(1000, 0), 1000);
});

test("reembolso: caução − descontos, nunca negativo", () => {
  const descontos: DescontoReembolso[] = [
    { motivo: "Reparo de parede", valor: 300, evidencia: "foto1.jpg" },
    { motivo: "Limpeza extra", valor: 200, evidencia: null },
  ];
  assert.equal(totalDescontos(descontos), 500);
  assert.equal(calcularReembolso(2_000, descontos), 1_500);
  // descontos maiores que a caução → devolve 0, nunca negativo
  assert.equal(calcularReembolso(400, descontos), 0);
  // sem descontos → devolve tudo
  assert.equal(calcularReembolso(2_000, []), 2_000);
});

test("descontos ignoram valores negativos (não inflam o reembolso)", () => {
  const descontos: DescontoReembolso[] = [
    { motivo: "ok", valor: 100, evidencia: null },
    { motivo: "estranho", valor: -50, evidencia: null },
  ];
  assert.equal(totalDescontos(descontos), 100);
});
