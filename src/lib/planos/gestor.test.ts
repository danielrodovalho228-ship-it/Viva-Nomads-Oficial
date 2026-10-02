/** Testes da elegibilidade do plano Gestor (regra 1 da escada de planos). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gestorElegivel, faltamParaGestor, GESTOR_MIN_IMOVEIS_VALIDADOS } from "./gestor.ts";

test("account_type='gestor' → elegível independente do nº de imóveis", () => {
  assert.equal(gestorElegivel({ accountType: "gestor", imoveisValidados: 0 }), true);
});

test("5+ imóveis validados → elegível; menos → não", () => {
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 5 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 6 }), true);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 4 }), false);
  assert.equal(gestorElegivel({ accountType: "individual", imoveisValidados: 0 }), false);
});

test("conta comum sem imóveis validados NÃO ativa Gestor (barreira)", () => {
  assert.equal(gestorElegivel({ accountType: null, imoveisValidados: 3 }), false);
});

test("faltamParaGestor conta o que resta até o limiar", () => {
  assert.equal(faltamParaGestor(0), GESTOR_MIN_IMOVEIS_VALIDADOS);
  assert.equal(faltamParaGestor(3), 2);
  assert.equal(faltamParaGestor(5), 0);
  assert.equal(faltamParaGestor(9), 0);
});
