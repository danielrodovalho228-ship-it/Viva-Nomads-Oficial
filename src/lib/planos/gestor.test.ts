/** Testes da elegibilidade do plano Gestor (regra 1 da escada de planos). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gestorElegivel, faltamParaGestor, GESTOR_MIN_IMOVEIS_VALIDADOS } from "./gestor.ts";

test("account_type='gestor' → elegível independente do nº de imóveis", () => {
  assert.equal(gestorElegivel({ accountType: "gestor", imoveisValidados: 0 }), true);
});

test("20+ imóveis validados → elegível; menos → não (mesmo mínimo do preço do Gestor)", () => {
  assert.equal(GESTOR_MIN_IMOVEIS_VALIDADOS, 20);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 20 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 25 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 19 }), false);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 5 }), false);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 0 }), false);
});

test("conta comum sem imóveis validados NÃO ativa Gestor (barreira)", () => {
  assert.equal(gestorElegivel({ accountType: null, imoveisValidados: 3 }), false);
});

test("faltamParaGestor conta o que resta até o limiar", () => {
  assert.equal(faltamParaGestor(0), GESTOR_MIN_IMOVEIS_VALIDADOS);
  assert.equal(faltamParaGestor(3), 17);
  assert.equal(faltamParaGestor(20), 0);
  assert.equal(faltamParaGestor(30), 0);
});
