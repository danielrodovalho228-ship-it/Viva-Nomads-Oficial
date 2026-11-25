/*
  Achado 30 (frente erros/estados vazios): em /dashboard/parceiro/avaliacao, falha na leitura dos pedidos ou das
  designações não pode virar "Nenhuma avaliação esperando a sua resposta" — o avaliador tem 24 h para responder.
  Roda: node --test src/lib/vistoria/achado30-lista-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", import.meta.url), "utf8");

test("as duas leituras guardam o erro", () => {
  assert.match(page, /\{ data: pedidos, error: erroPedidos \}/);
  assert.match(page, /\{ data: designacoes, error: erroDesignacoes \}/);
  assert.match(page, /const leituraFalhou = Boolean\(erroPedidos \|\| erroDesignacoes\)/);
});

test("com falha, aviso no lugar das três listas (nunca o estado vazio)", () => {
  const i = page.indexOf("{leituraFalhou ? (");
  assert.ok(i > 0);
  const aviso = page.slice(i, page.indexOf(") : (", i));
  assert.match(aviso, /data-testid="avaliacoes-erro"/);
  assert.match(aviso, /role="alert"/);
  assert.match(aviso, /MSG_AVALIACOES_FALHOU/);
  assert.doesNotMatch(aviso, /Nenhuma avaliação/);
  assert.ok(page.indexOf('data-testid="avaliacoes-designadas"') > i, "as listas ficam no ramo sem falha");
  assert.match(page, /Não foi possível carregar as suas avaliações agora/);
});
