/* Roda: node --test src/lib/atendimento/viva-custo.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aceitaEsforco, aceitaReserva, cotacaoDolar, custoUsd, modeloViva, MODELO_PADRAO } from "./viva-custo.ts";

test("modelo vem da variável, com o atual como padrão", () => {
  assert.equal(modeloViva(undefined), MODELO_PADRAO);
  assert.equal(modeloViva(""), MODELO_PADRAO);
  assert.equal(modeloViva("claude-sonnet-5-5"), "claude-sonnet-5-5");
  assert.equal(modeloViva(" claude-haiku-4-5 "), "claude-haiku-4-5");
  assert.equal(modeloViva("gpt-4"), MODELO_PADRAO);
  assert.equal(modeloViva("claude-opus-5-5; drop table"), MODELO_PADRAO);
});

test("custo: entrada, escrita e leitura do cache, saída", () => {
  // 1 M de cada no Opus 5.5: 4 + 5 (1,25 × 4) + 0,20 + 20 = 29,20
  assert.equal(custoUsd("claude-opus-5-5", { entrada: 1e6, cacheEscrita: 1e6, cacheLida: 1e6, saida: 1e6 })?.toFixed(2), "29.20");
  assert.equal(custoUsd("claude-sonnet-5-5", { entrada: 1e6, cacheEscrita: 0, cacheLida: 0, saida: 1e6 }), 12);
  assert.equal(custoUsd("modelo-desconhecido", { entrada: 1, cacheEscrita: 0, cacheLida: 0, saida: 1 }), null);
});

test("o que cada modelo aceita", () => {
  assert.equal(aceitaReserva("claude-opus-5-5"), true);
  assert.equal(aceitaReserva("claude-sonnet-5-5"), false);
  assert.equal(aceitaEsforco("claude-haiku-4-5"), false);
  assert.equal(aceitaEsforco("claude-sonnet-5-5"), true);
});

test("cotação do dólar configurável", () => {
  assert.equal(cotacaoDolar(undefined), 5.5);
  assert.equal(cotacaoDolar("5,72"), 5.72);
  assert.equal(cotacaoDolar("abc"), 5.5);
});
