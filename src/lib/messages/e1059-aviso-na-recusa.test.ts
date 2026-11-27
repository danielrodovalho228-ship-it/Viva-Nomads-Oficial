/*
  E1059 (resto, ORDEM-DUET-313/319): a regra aprovada é RECUSA COM AVISO. A recusa já funcionava (nada é entregue), mas
  quando o SERVIDOR recusava o envio (CPF/RG, pedido encerrado, falha ao gravar) a tela ignorava a resposta: o eco
  otimista ficava na conversa como se tivesse ido e nenhum aviso aparecia. Agora a recusa do servidor tira o eco,
  devolve o texto ao campo e mostra o aviso que o servidor mandou (o mesmo texto, nada inventado).
  Roda: node --test src/lib/messages/e1059-aviso-na-recusa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoAntesDeEnviar, recusaDoEnvio } from "./aviso-envio.ts";
import { DOCUMENTO_BLOQUEADO } from "./contact-guard.ts";
import { MSG_ACAO_FALHOU } from "../erro-de-rede.ts";

const PROVA = "Meu CPF é 123.456.789-00 para o cadastro.";
const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx", import.meta.url), "utf8");

test("E1059 — a frase da prova é recusada antes de enviar e a tela mostra o aviso do documento", () => {
  assert.equal(avisoAntesDeEnviar(PROVA).tipo, "documento");
  assert.match(tela, /setDocBloqueado\(aviso\.tipo === "documento"\);\s*if \(aviso\.tipo === "documento"\) return;/);
  assert.match(tela, /\{docBloqueado && \(\s*<p role="alert"[^>]*data-testid="mensagens-documento-bloqueado">\s*\{DOCUMENTO_BLOQUEADO\}/);
});

test("E1059 — recusaDoEnvio: o aviso que o servidor mandou, nunca vazio; envio aceito ou termo ofensivo não são recusa", () => {
  assert.equal(recusaDoEnvio({ ok: false, error: `${DOCUMENTO_BLOQUEADO}.` }), `${DOCUMENTO_BLOQUEADO}.`);
  assert.equal(recusaDoEnvio({ ok: false, erro: "Dados de documento não vão pelo chat." }), "Dados de documento não vão pelo chat.");
  assert.equal(recusaDoEnvio({ ok: false }), MSG_ACAO_FALHOU);
  assert.equal(recusaDoEnvio({ ok: true }), null);
  assert.equal(recusaDoEnvio({ ok: false, ofensa: true, error: "x" }), null);
  assert.equal(recusaDoEnvio(null), MSG_ACAO_FALHOU);
});

test("E1059 — recusa do servidor: tira o eco, devolve o texto e mostra o aviso (chat e conversa do pedido)", () => {
  assert.match(tela, /const recusa = recusaDoEnvio\(r\);\s*if \(recusa\) \{\s*tirarEco\(text\);\s*setDraft\(text\);\s*setRecusaEnvio\(recusa\);/);
  assert.match(tela, /const r = await semQuedaDeRede\(enviarMensagemDoPedido\(active\.pedidoParceiroId, text\)\);/);
  assert.match(tela, /\{recusaEnvio && \(\s*<p role="alert"[^>]*data-testid="mensagens-envio-recusado">\s*\{recusaEnvio\}/);
  // Um novo envio ou outra conversa limpam o aviso.
  assert.ok((tela.match(/setRecusaEnvio\(null\)/g) ?? []).length >= 2);
});
