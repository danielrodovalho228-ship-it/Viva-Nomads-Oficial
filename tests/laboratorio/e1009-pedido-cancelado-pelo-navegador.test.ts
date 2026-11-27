/*
  E1009 (Gerente, ronda 04:19 de 17/11/2026) — pedidos que o próprio navegador cancela ao trocar de tela não são erro
  da página (critério d da varredura). A régua já aceitava o prefetch do Next, a ação do servidor, o arquivo de /_next
  e a leitura em /api. Faltavam dois, que a re-triagem de 17/11 achou como falha instável da t1409 e da t1442:
    - o ícone do site (/favicon.ico), cancelado quando a tela troca antes de ele chegar;
    - a leitura do banco (GET em /rest/v1), cancelada pela tela que saiu (a leitura de `profiles`).
  Só net::ERR_ABORTED e só GET: escrita cancelada e qualquer outro erro de rede continuam acusando.
  Prova ao vivo: tests/e2e/specs/t1687-e1009-pedido-cancelado-pelo-navegador.spec.ts.
  Roda: node --test tests/laboratorio/e1009-pedido-cancelado-pelo-navegador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOTIVO_ARQUIVO_CANCELADO, MOTIVO_LEITURA_CANCELADA, canceladaPeloNavegador } from "../e2e/fixtures/requisicao-cancelada.ts";

const ABORT = "net::ERR_ABORTED";
const SITE = "http://localhost:3123";
const BANCO = "http://127.0.0.1:54321";

test("o ícone do site cancelado pelo navegador não conta", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/favicon.ico`, {}), "arquivo");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/favicon.ico?v=2`, {}), "arquivo");
});

test("a leitura do banco cancelada pela tela não conta", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${BANCO}/rest/v1/profiles?select=papel_ativo&id=eq.123`, {}), "leitura");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", "https://projeto.supabase.co/rest/v1/properties?select=id", {}), "leitura");
});

test("o resto continua acusando: escrita cancelada, outro erro de rede e outros caminhos", () => {
  // Escrita no banco cancelada: pode ser dado que não gravou.
  for (const metodo of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(canceladaPeloNavegador(ABORT, metodo, `${BANCO}/rest/v1/profiles?id=eq.123`, {}), null, metodo);
  // Leitura do banco ou ícone que falharam por outro motivo.
  for (const erro of ["net::ERR_CONNECTION_REFUSED", "net::ERR_FAILED", "net::ERR_NAME_NOT_RESOLVED", "net::ERR_TIMED_OUT"]) {
    assert.equal(canceladaPeloNavegador(erro, "GET", `${BANCO}/rest/v1/profiles`, {}), null, erro);
    assert.equal(canceladaPeloNavegador(erro, "GET", `${SITE}/favicon.ico`, {}), null, erro);
  }
  // Outros caminhos do banco (login, arquivos, funções) e outros arquivos do site, mesmo cancelados.
  for (const url of [`${BANCO}/auth/v1/user`, `${BANCO}/storage/v1/object/public/fotos/a.webp`, `${BANCO}/functions/v1/x`, `${BANCO}/rest/v2/profiles`, `${SITE}/rest/v1`, `${SITE}/icone.png`, `${SITE}/imagens/favicon.ico`, `${SITE}/favicon.icon`, `${SITE}/dados.json`])
    assert.equal(canceladaPeloNavegador(ABORT, "GET", url, {}), null, url);
});

test("as exceções de antes continuam iguais", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/buscar?_rsc=abc`, {}), "prefetch");
  assert.equal(canceladaPeloNavegador(ABORT, "POST", `${SITE}/buscar`, { "next-action": "7f3a" }), "acao");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/_next/static/chunks/a.js`, {}), "arquivo");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/_next/image?url=%2Ffoto.png&w=640&q=75`, {}), "arquivo");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/api/painel/contadores`, {}), "leitura");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${SITE}/buscar`, {}), null);
  assert.equal(canceladaPeloNavegador(ABORT, "POST", `${SITE}/api/dados`, {}), null);
});

test("o relatório diz o que foi deixado de fora: os motivos citam o ícone e a leitura do banco", () => {
  assert.match(MOTIVO_ARQUIVO_CANCELADO, /\/favicon\.ico/);
  assert.match(MOTIVO_ARQUIVO_CANCELADO, /net::ERR_ABORTED/);
  assert.match(MOTIVO_LEITURA_CANCELADA, /\/rest\/v1/);
  assert.match(MOTIVO_LEITURA_CANCELADA, /net::ERR_ABORTED/);
  // A varredura continua pondo os motivos na lista de exceções do relatório em vez de sumir com eles.
  const varredura = readFileSync("tests/e2e/fixtures/varredura.ts", "utf8");
  assert.match(varredura, /\.\.\.\(arquivoCancelado \? \[MOTIVO_ARQUIVO_CANCELADO\] : \[\]\),/);
  assert.match(varredura, /\.\.\.\(leituraCancelada \? \[MOTIVO_LEITURA_CANCELADA\] : \[\]\),/);
});
