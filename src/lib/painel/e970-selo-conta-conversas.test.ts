/*
  E970 (Família 6, item A5) — a unidade é a CONVERSA em qualquer total (regra do coordenador, ORDEM-DUET-068 ponto 3):
  o selo da aba Mensagens conta conversas com pelo menos uma não lida; o sino guarda um aviso por conversa e bate com
  esse selo; o número de MENSAGENS não lidas aparece só dentro da linha de cada conversa.
  Cenário da trava t2018: 2 não lidas no Alfa e 1 no Beta → selo 2, sino 2, linhas 2 e 1.
  Roda: node --test src/lib/painel/e970-selo-conta-conversas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTADORES_VAZIOS, conversasComNaoLidas, normalizarContadores, seloDeMensagens } from "./contadores.ts";
import { chaveDoAvisoPendente } from "../notifications/avisos.ts";

test("E970 — 2 não lidas no Alfa e 1 no Beta: o selo é 2 (conversas), não 3 (mensagens)", () => {
  assert.equal(conversasComNaoLidas([{ nao_lidas: 2 }, { nao_lidas: 1 }]), 2);
  assert.equal(conversasComNaoLidas({ alfa: 2, beta: 1, gama: 0 }), 2);
  assert.equal(conversasComNaoLidas([]), 0);
  assert.equal(conversasComNaoLidas(null), 0);
  assert.equal(seloDeMensagens(normalizarContadores({ conversasNaoLidas: 2, mensagensRecebidas: 7 })), 2);
  assert.equal(CONTADORES_VAZIOS.conversasNaoLidas, 0);
});

test("E970 — o contador do servidor tira o selo da mesma RPC que dá o número de cada linha", () => {
  const s = readFileSync("src/lib/painel/contadores-servidor.ts", "utf8");
  assert.match(s, /supabase\.rpc\("mensagens_nao_lidas"\)\)\s*\.then\(\(r\) => \(r\.error \? 0 : conversasComNaoLidas\(/);
  assert.match(s, /conversasNaoLidas,\n\s*\};/);
});

test("E970 — o sino guarda UM aviso de mensagem nova por conversa (ref_id = conversa), igual ao selo", () => {
  assert.deepEqual(chaveDoAvisoPendente({ evento: "new_message", refId: "conv-alfa", titulo: "Nova mensagem" }), { evento: "new_message", refId: "conv-alfa" });
  const r = readFileSync("src/lib/respostas/servidor.ts", "utf8");
  assert.match(r, /event: "new_message",[^\n]*refId: conversa/);
});
