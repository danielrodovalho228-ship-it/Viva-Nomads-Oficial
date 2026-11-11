/*
  Ordem 12a8086d, item 4 (parte 2): a sessão do admin parada há mais de 30 min também vale na API /api/admin.
  Antes, o proxy só olhava as páginas /admin: com o painel parado, um fetch para /api/admin seguia respondendo.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMITE_OCIOSO_ADMIN_MS,
  apiAdminRenovaAtividade,
  respostaApiAdminOciosa,
  rotaApiAdmin,
} from "./sessao-ociosa.ts";

test("rotaApiAdmin: só /api/admin e subcaminhos", () => {
  assert.equal(rotaApiAdmin("/api/admin"), true);
  assert.equal(rotaApiAdmin("/api/admin/aprovacoes"), true);
  assert.equal(rotaApiAdmin("/api/admin/agentes/chat"), true);
  // caso negativo: parecidas mas não são a API do admin
  assert.equal(rotaApiAdmin("/api/administracao"), false);
  assert.equal(rotaApiAdmin("/admin"), false);
  assert.equal(rotaApiAdmin("/api/upload/foto"), false);
});

test("só ação de verdade renova a atividade; leitura (GET/HEAD/OPTIONS) não segura a sessão aberta", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) assert.equal(apiAdminRenovaAtividade(m), true, m);
  for (const m of ["GET", "HEAD", "OPTIONS", "get"]) assert.equal(apiAdminRenovaAtividade(m), false, m);
});

test("resposta da API ociosa: 401, sem cache, sem detalhe interno", async () => {
  const r = respostaApiAdminOciosa();
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const corpo = (await r.json()) as { erro: string };
  assert.equal(corpo.erro, "Sessão expirada. Entre de novo.");
});

test("proxy: /api/admin passa pelo proxy e aplica o limite de 30 min", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /"\/api\/admin\/:path\*"/);
  assert.match(proxy, /rotaApiAdmin\(pathname\)/);
  assert.match(proxy, /respostaApiAdminOciosa\(\)/);
  assert.equal(LIMITE_OCIOSO_ADMIN_MS, 30 * 60 * 1000);
});
