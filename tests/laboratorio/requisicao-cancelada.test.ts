import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cabecalhosComOrigem, canceladaPeloNavegador } from "../e2e/fixtures/requisicao-cancelada.ts";

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

// E744, passo 2 (15/11): salto de redirecionamento de uma ação do servidor.
// Medido no laboratório: a casca dispara a ação em /dashboard/conta, o proxy (E798) responde 307 para /dashboard/conta/perfil
// e a troca de tela cancela o salto. O Playwright não repete no salto os cabeçalhos do pedido original (o next-action some),
// e a varredura acusava "requisição falhou (fetch POST, net::ERR_ABORTED)" numa ação que a regra de 22/10 já manda não contar.
type Pedido = { headers(): Record<string, string>; redirectedFrom(): Pedido | null };
const pedido = (cabecalhos: Record<string, string>, de: Pedido | null = null): Pedido => ({ headers: () => cabecalhos, redirectedFrom: () => de });

test("E744: o salto redirecionado herda os cabeçalhos do pedido original (a ação do servidor segue reconhecida)", () => {
  const original = pedido({ "next-action": "7f3a", accept: "text/x-component" });
  const salto = pedido({ accept: "text/x-component" }, original);
  assert.equal(cabecalhosComOrigem(salto)["next-action"], "7f3a");
  assert.equal(canceladaPeloNavegador(ABORT, "POST", "http://localhost:3123/dashboard/conta/perfil", cabecalhosComOrigem(salto)), "acao");
  // Dois saltos seguidos: sobe a cadeia inteira; o cabeçalho do salto vence o do original quando os dois existem.
  const segundo = pedido({ accept: "outro" }, salto);
  assert.equal(cabecalhosComOrigem(segundo)["next-action"], "7f3a");
  assert.equal(cabecalhosComOrigem(segundo).accept, "outro");
});

test("E744: POST comum redirecionado e abortado continua acusando; pedido sem redirecionamento não muda", () => {
  const salto = pedido({}, pedido({ "content-type": "application/json" }));
  assert.equal(canceladaPeloNavegador(ABORT, "POST", URL_TELA, cabecalhosComOrigem(salto)), null);
  const direto = pedido({ "next-action": "7f3a" });
  assert.deepEqual(cabecalhosComOrigem(direto), { "next-action": "7f3a" });
});

test("E744: a varredura reconhece a ação do servidor pelo pedido original, nos dois pontos em que lê o cabeçalho", () => {
  const fixture = readFileSync("tests/e2e/fixtures/varredura.ts", "utf8");
  assert.match(fixture, /canceladaPeloNavegador\(motivo, r\.method\(\), r\.url\(\), cabecalhosComOrigem\(r\)\)/);
  assert.match(fixture, /cabecalhosComOrigem\(r\)\["next-action"\]/);
  assert.doesNotMatch(fixture, /canceladaPeloNavegador\([^)]*r\.headers\(\)\)/);
});
