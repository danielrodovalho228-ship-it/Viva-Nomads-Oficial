import { test } from "node:test";
import assert from "node:assert/strict";
import { mesesDoCartao, rotuloPrecoCartao, textoPrecoCartao } from "./cartao-preco.ts";

const limpo = (s: string) => s.replace(/\s/g, " ");

test('preço do cartão: "R$ X/mês · R$ Y em N meses"; com N = 1 só "R$ X/mês" (sem "total" solto)', () => {
  assert.equal(limpo(textoPrecoCartao(3130, 1)), "R$ 3.130/mês");
  assert.equal(limpo(textoPrecoCartao(3130, 2)), "R$ 3.130/mês · R$ 6.260 em 2 meses");
  assert.equal(limpo(textoPrecoCartao(3130, 6)), "R$ 3.130/mês · R$ 18.780 em 6 meses");
  assert.equal(rotuloPrecoCartao(3130, 1).estadia, null);
  for (const n of [1, 2, 6]) assert.doesNotMatch(textoPrecoCartao(2500, n), /total/);
});

test("meses: duração da busca ou, sem busca, a estadia mínima (arredondada para cima)", () => {
  assert.equal(mesesDoCartao(3, 30), 3);
  assert.equal(mesesDoCartao(undefined, 30), 1);
  assert.equal(mesesDoCartao(undefined, 60), 2);
  assert.equal(mesesDoCartao(0, 45), 2);
  assert.equal(mesesDoCartao(undefined, 180), 6);
});
