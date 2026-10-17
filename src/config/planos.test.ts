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

test("comissão = aluguel × meses × taxa, cobrada do proprietário (nunca o aluguel)", () => {
  assert.equal(valorComissao(3000, 1, 0.12), 360);
  assert.equal(valorComissao(3000, 3, 0.12), 1080);
  assert.equal(valorComissao(3000, 6, 0.12), 2160);
  assert.equal(valorComissao(2900, 1, 0.1), 290);
  assert.equal(valorComissao(3000, 3, 0), 0);
  assert.equal(valorComissao(0, 3, 0.12), 0);
});

test("#82 (ordem 90181c57): contrato congelado em 6% (faixa 16+ imóveis) usa 6%, não a taxa do plano", () => {
  assert.equal(taxaDoContrato(0.06, "free"), 0.06);
  assert.equal(taxaDoContrato("0.06", "essential"), 0.06);
  assert.equal(taxaDoContrato(0.1, "free"), 0.1);
});
