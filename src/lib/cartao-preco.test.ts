/* Roda: node --test src/lib/cartao-preco.test.ts — Prompt 47: rotuloPreco, a função única do preço com contexto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mesesDoCartao, rotuloPreco, textoPreco, totalDoPeriodo } from "./cartao-preco.ts";

const limpo = (s: string) => s.replace(/ /g, " ");
const HOJE = new Date("2026-10-22T12:00:00Z");

test("rotuloPreco: 6 casos — mensal, período, data futura, data passada, sem data e centavos", () => {
  const um = rotuloPreco({ mensal: 3130, meses: 1 });
  assert.equal(limpo(um.mes), "R$ 3.130/mês");
  assert.equal(um.estadia, null);
  assert.equal(um.total, 3130);
  const seis = rotuloPreco({ mensal: 3130, meses: 6, disponivelEm: "2026-11-15", hoje: HOJE });
  assert.equal(limpo(textoPreco(seis)), "R$ 3.130/mês · R$ 18.780 em 6 meses");
  assert.equal(seis.disponivel, "Disponível a partir de 15/11");
  assert.equal(rotuloPreco({ mensal: 2500, meses: 3, disponivelEm: "2027-02-01", hoje: HOJE }).disponivel, "Disponível a partir de 01/02/2027");
  assert.equal(rotuloPreco({ mensal: 2500, meses: 3, disponivelEm: "2026-10-01", hoje: HOJE }).disponivel, "Disponível agora");
  assert.equal(rotuloPreco({ mensal: 2500, meses: 3 }).disponivel, null);
  const centavos = rotuloPreco({ mensal: 3333.33, meses: 3 });
  assert.equal(centavos.total, 9999.99);
  for (const n of [1, 2, 6]) assert.doesNotMatch(textoPreco(rotuloPreco({ mensal: 2500, meses: n })), /total/);
});

test("totalDoPeriodo conta em centavos; meses inválidos não quebram", () => {
  assert.equal(totalDoPeriodo(0.1 + 0.2, 3), 0.9);
  assert.equal(totalDoPeriodo(1999.995, 2), 4000);
  assert.equal(totalDoPeriodo(2000, -1), 0);
  assert.equal(rotuloPreco({ mensal: 2000, meses: 0 }).meses, 1);
});

test("meses do cartão: duração da busca ou estadia mínima", () => {
  assert.equal(mesesDoCartao(4, 30), 4);
  assert.equal(mesesDoCartao(undefined, 90), 3);
  assert.equal(mesesDoCartao(undefined, undefined), 1);
});
