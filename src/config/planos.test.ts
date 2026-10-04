/*
  Taxa de comissão do contrato e valor da comissão.
  Roda: node --test src/config/planos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { taxaDoContrato, COMISSAO_POR_PLANO } from "./planos.ts";
import { valorComissao } from "../lib/comissao.ts";

test("taxa congelada NULL não vira 0 (Gestor): cai para o plano do aceite", () => {
  assert.equal(taxaDoContrato(null, "essential"), COMISSAO_POR_PLANO.essential);
  assert.equal(taxaDoContrato(undefined, "pro"), COMISSAO_POR_PLANO.pro);
  assert.equal(taxaDoContrato(null, null), COMISSAO_POR_PLANO.free);
  assert.equal(taxaDoContrato("", "lixo"), COMISSAO_POR_PLANO.free);
});

test("taxa congelada válida vale (inclusive 0 do Gestor gravado de verdade)", () => {
  assert.equal(taxaDoContrato(0.08, "free"), 0.08);
  assert.equal(taxaDoContrato("0.1", "free"), 0.1);
  assert.equal(taxaDoContrato(0, "gestor"), 0);
  assert.equal(taxaDoContrato(0.5, "essential"), COMISSAO_POR_PLANO.essential); // inventada
});

test("comissão = 1 aluguel × taxa, cobrada do proprietário (nunca o aluguel)", () => {
  assert.equal(valorComissao(3000, 0.12), 360);
  assert.equal(valorComissao(2900, 0.1), 290);
  assert.equal(valorComissao(3000, 0), 0);
  assert.equal(valorComissao(0, 0.12), 0);
});
