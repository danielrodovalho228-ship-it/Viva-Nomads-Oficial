/*
  E345 — o pedido de avaliação se contradizia no mesmo e-mail: o corpo dizia "ajuda os próximos moradores e
  proprietários" e o bloco (detalhe do cron) só "ajuda os próximos moradores". Uma frase só (FRASE_AVALIACAO).
  Roda: node --test src/lib/automacoes/e345-frase-avaliacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRASE_AVALIACAO, detalheAutomacao } from "./regras.ts";
import { corpoAutomacao } from "./corpo-automacao.ts";

test("corpo e bloco do pedido de avaliação dizem a mesma frase", () => {
  const corpo = corpoAutomacao("avaliacao_pedido", { imovel: { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" }, data: "2026-10-30" }).body("Ana");
  const bloco = detalheAutomacao("avaliacao_pedido", { imovel: "Imóvel: Apto Santa Mônica · Santa Mônica, Uberlândia.", fim: "2026-10-30" });
  assert.ok(corpo.endsWith(FRASE_AVALIACAO), corpo);
  assert.ok(bloco.endsWith(FRASE_AVALIACAO), bloco);
  assert.equal(FRASE_AVALIACAO, "Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.");
});

test("nenhum texto de avaliação diz só 'ajuda os próximos moradores.'", () => {
  for (const f of ["src/lib/automacoes/regras.ts", "src/lib/automacoes/corpo-automacao.ts", "src/lib/notifications/eventos-email.ts"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /ajuda os próximos moradores\./, f);
  }
});
