/*
  E967 — falha de rede no envio do chat: a bolha não some, diz que não foi e oferece "Tentar de novo".
  Roda: node --test src/lib/mensagens/e967-envio-otimista.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { falhaDoEnvio, ROTULO_TENTAR_DE_NOVO, TEXTO_NAO_ENVIADA } from "./envio-otimista.ts";
import { MSG_SEM_CONEXAO } from "../erro-de-rede.ts";

test("E967 — gravou: sem falha; ofensa (E445) não é falha", () => {
  assert.equal(falhaDoEnvio({ ok: true }), null);
  assert.equal(falhaDoEnvio({ ok: false, ofensa: true, error: "termo" }), null);
});

test("E967 — rede caiu (semQuedaDeRede devolve ok:false com o texto em português): a falha traz o motivo", () => {
  assert.equal(falhaDoEnvio({ ok: false, erro: MSG_SEM_CONEXAO, error: MSG_SEM_CONEXAO }), MSG_SEM_CONEXAO);
  assert.equal(falhaDoEnvio({ ok: false, error: "Não foi possível enviar a mensagem agora. Tente de novo em instantes." }), "Não foi possível enviar a mensagem agora. Tente de novo em instantes.");
  assert.equal(falhaDoEnvio(undefined), MSG_SEM_CONEXAO);
});

test("E967 — a tela marca a bolha como não enviada, com o motivo e 'Tentar de novo' (sem sumir nem duplicar)", () => {
  assert.equal(TEXTO_NAO_ENVIADA, "Não foi enviada.");
  assert.equal(ROTULO_TENTAR_DE_NOVO, "Tentar de novo");
  const s = readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8");
  assert.match(s, /const falha = falhaDoEnvio\(r\);/);
  assert.match(s, /data-testid="mensagem-nao-enviada"/);
  assert.match(s, /data-testid="mensagem-tentar-de-novo"/);
  // "Tentar de novo" tira a bolha que falhou antes de reenviar (uma bolha, uma gravação).
  assert.match(s, /function tentarDeNovo\(m: ChatMessage\)/);
});
