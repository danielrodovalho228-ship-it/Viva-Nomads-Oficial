import { test } from "node:test";
import assert from "node:assert/strict";
import { canceladaPeloNavegador } from "../e2e/fixtures/requisicao-cancelada.ts";

const ABORT = "net::ERR_ABORTED";
const URL_TELA = "http://localhost:3123/buscar";

test("prefetch do Next cancelado não conta", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", `${URL_TELA}?_rsc=abc`, {}), "prefetch");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", URL_TELA, { rsc: "1" }), "prefetch");
});

test("ação do servidor cancelada pela navegação não conta (decisão do Muse, 22/10)", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "POST", URL_TELA, { "next-action": "7f3a" }), "acao");
});

test("arquivo do próprio site cancelado pela navegação não conta (L-3, 22/10)", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", "http://localhost:3123/_next/static/chunks/3ns72bvya0a2t.js", {}), "arquivo");
  assert.equal(canceladaPeloNavegador(ABORT, "GET", "http://localhost:3123/_next/image?url=%2Ffoto.png&w=640&q=75", {}), "arquivo");
});

test("leitura do próprio site em /api cancelada pela tela não conta (rodada de 22/10)", () => {
  assert.equal(canceladaPeloNavegador(ABORT, "GET", "http://localhost:3123/api/painel/contadores", {}), "leitura");
});

test("o resto continua acusando", () => {
  // Ação do servidor que falhou por outro motivo.
  assert.equal(canceladaPeloNavegador("net::ERR_CONNECTION_REFUSED", "POST", URL_TELA, { "next-action": "7f3a" }), null);
  // Documento ou POST comum abortados.
  assert.equal(canceladaPeloNavegador(ABORT, "GET", URL_TELA, {}), null);
  assert.equal(canceladaPeloNavegador(ABORT, "POST", URL_TELA, {}), null);
  // Arquivo do site que falhou por outro motivo, e GET abortado fora de /_next/static.
  assert.equal(canceladaPeloNavegador("net::ERR_CONNECTION_REFUSED", "GET", "http://localhost:3123/_next/static/chunks/a.js", {}), null);
  assert.equal(canceladaPeloNavegador("net::ERR_FAILED", "GET", "http://localhost:3123/_next/image?url=%2Ffoto.png", {}), null);
  assert.equal(canceladaPeloNavegador("net::ERR_CONNECTION_REFUSED", "GET", "http://localhost:3123/api/dados", {}), null);
  assert.equal(canceladaPeloNavegador(ABORT, "POST", "http://localhost:3123/api/dados", {}), null);
});
