/*
  E344 — proposta_vencendo era o único dos 8 e-mails do grupo 1 sem bairro/cidade na linha do imóvel ("Imóvel: [TESTE
  QA] Automações E289 R." × "… · Santa Mônica, Uberlândia" nos outros 7). O detalhe do cron recebia só o título; agora
  recebe a mesma linhaImovel (título · bairro, cidade) dos vizinhos.
  Roda: node --test src/lib/automacoes/e344-proposta-bairro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaImovel } from "../notifications/transacionais-estadia.ts";

const cron = readFileSync(new URL("../../app/api/cron/automacoes/route.ts", import.meta.url), "utf8");

test("o detalhe da proposta vencendo leva título · bairro, cidade (linhaImovel), como os outros e-mails do cron", () => {
  const i = cron.indexOf('tipo: "proposta_vencendo"');
  assert.ok(i > 0);
  const bloco = cron.slice(i, cron.indexOf("decisao:", i));
  assert.match(bloco, /detalheAutomacao\("proposta_vencendo", \{ imovel: \(pp \? linhaImovel\(\{ titulo: pp\.title, bairro: pp\.address, cidade: pp\.city \}\) : ""\) \|\| undefined/);
  assert.doesNotMatch(bloco, /imovel: pp\?\.title \|\| undefined/);
  assert.equal(linhaImovel({ titulo: "[TESTE QA] Automações E289 R", bairro: "Santa Mônica", cidade: "Uberlândia" }), "[TESTE QA] Automações E289 R · Santa Mônica, Uberlândia");
});

test("nenhum e-mail do grupo 1 (saída, avaliação, renovação, proposta, instruções) monta o imóvel do detalhe só com o título", () => {
  for (const tipo of ["saida_lembrete", "avaliacao_pedido", "renovacao_aviso", "proposta_vencendo", "estadia_instrucoes_pendentes"]) {
    const re = new RegExp(`detalheAutomacao\\("${tipo}", \\{ imovel: [a-z]+\\??\\.title`);
    assert.doesNotMatch(cron, re, tipo);
  }
});
