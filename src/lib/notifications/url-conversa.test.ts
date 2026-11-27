/* Roda: node --test src/lib/notifications/url-conversa.test.ts — E541 (resto): o aviso de mensagem nova abre A conversa. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlDaConversa, urlDoAvisoComConversa } from "./url-conversa.ts";

const C = "0b5c8f2e-1f1a-4c3e-9a7b-2d4e6f8a0b1c";

test("a conversa entra no endereço (sem id válido, a lista)", () => {
  assert.equal(urlDaConversa(C), `/dashboard/mensagens?conversa=${C}`);
  assert.equal(urlDaConversa(null), "/dashboard/mensagens");
  assert.equal(urlDaConversa("x' or 1=1"), "/dashboard/mensagens");
});

test("aviso antigo de mensagem nova (sem a conversa na url) abre a conversa do ref_id; outros eventos não mudam", () => {
  assert.equal(urlDoAvisoComConversa({ evento: "new_message", url: "/dashboard/mensagens", ref_id: C }), `/dashboard/mensagens?conversa=${C}`);
  assert.equal(urlDoAvisoComConversa({ evento: "new_message", url: "/dashboard/mensagens", ref_id: null }), "/dashboard/mensagens");
  assert.equal(urlDoAvisoComConversa({ evento: "new_message", url: `/dashboard/mensagens?conversa=${C}`, ref_id: C }), `/dashboard/mensagens?conversa=${C}`);
  assert.equal(urlDoAvisoComConversa({ evento: "proposta_aceita", url: "/dashboard/propostas", ref_id: C }), "/dashboard/propostas");
});

test("produtores: a mensagem nova grava/envia o endereço da conversa (push, aviso e e-mail)", () => {
  const acoes = readFileSync("src/lib/data/actions.ts", "utf8");
  assert.match(acoes, /pushUrl: urlDaConversa\(conversationId\),/);
  assert.match(acoes, /const link = `\$\{SITE_URL\}\$\{urlDaConversa\(conversationId\)\}`;/);
  const programadas = readFileSync("src/lib/respostas/servidor.ts", "utf8");
  assert.match(programadas, /event: "new_message", userId: c\.tenant_id, pushUrl: urlDaConversa\(conversa\), conversationId: conversa, refId: conversa/);
});

test("leitura do sino e da lista: o destino passa por urlDoAvisoComConversa (avisos já gravados também)", () => {
  const s = readFileSync("src/lib/data/avisos-actions.ts", "utf8");
  assert.match(s, /ler\("id, evento, prioridade, titulo, texto, url, ref_id, criado_em, lido_em, resolvido_em"\)/); // E482: + texto
  assert.match(s, /url: urlDoAvisoComConversa\(a\)/);
});
