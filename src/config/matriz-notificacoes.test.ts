/*
  Prompt 42, item 6 — matriz de notificações (evento × papel × canal × categoria).
  Roda: node --test src/config/matriz-notificacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATRIZ_NOTIFICACOES,
  ROTULO_CATEGORIA,
  canaisDoEvento,
  categoriaDoEvento,
  categoriaTemInterruptor,
  type EventoNotificacao,
  type LinhaMatriz,
} from "./matriz-notificacoes.ts";
import { TEMPLATES } from "../lib/notifications/eventos-email.ts";
import { TEMA_POR_EVENTO } from "../lib/notifications/imagens-email.ts";
import { EVENTOS_SO_EQUIPE } from "../lib/notifications/catalogo-emails.ts";

const linhas = Object.entries(MATRIZ_NOTIFICACOES) as [EventoNotificacao, LinhaMatriz][];

test("cobre exatamente os eventos que existem (os de notify() e os e-mails avulsos)", () => {
  const existentes = new Set(Object.keys(TEMA_POR_EVENTO));
  for (const ev of Object.keys(TEMPLATES)) assert.ok(existentes.has(ev), ev);
  assert.deepEqual(new Set(Object.keys(MATRIZ_NOTIFICACOES)), existentes);
});

test("push só para decisão com prazo, segurança e mensagem nova (Prompt 44)", () => {
  for (const [ev, l] of linhas) {
    if (!l.canais.includes("push")) continue;
    assert.ok(l.categoria === "seguranca" || (l.categoria === "decisao" && l.prazo === true) || ev === "new_message", ev);
  }
  // E toda decisão com prazo chega por push.
  for (const [ev, l] of linhas) if (l.categoria === "decisao" && l.prazo) assert.ok(l.canais.includes("push"), ev);
});

test("decisão e segurança não têm interruptor; mensagens, lembretes e outros têm", () => {
  assert.equal(categoriaTemInterruptor("decisao"), false);
  assert.equal(categoriaTemInterruptor("seguranca"), false);
  assert.equal(categoriaTemInterruptor("mensagens"), true);
  assert.equal(categoriaTemInterruptor("lembretes"), true);
  assert.equal(categoriaTemInterruptor("outros"), true);
  for (const c of Object.keys(ROTULO_CATEGORIA)) assert.ok(ROTULO_CATEGORIA[c as keyof typeof ROTULO_CATEGORIA].length > 0);
});

test("canaisDoEvento: canais do papel que recebe; papel que não recebe fica sem nada", () => {
  assert.deepEqual(canaisDoEvento("proposta_recebida", "morador"), ["push", "central", "email"]);
  assert.deepEqual(canaisDoEvento("new_message", "proprietario"), ["push", "central", "email"]);
  assert.deepEqual(canaisDoEvento("visita_pedida", "morador"), []);
  assert.deepEqual(canaisDoEvento("chamado_equipe", "proprietario"), []);
  assert.deepEqual(canaisDoEvento("chamado_equipe", "admin"), ["central", "email"]);
  // Devolve cópia: quem chama não altera a matriz.
  canaisDoEvento("pedido_resposta", "morador").push("push");
  assert.deepEqual(canaisDoEvento("pedido_resposta", "morador"), ["central", "email"]);
  assert.equal(categoriaDoEvento("manutencao_atrasada"), "decisao");
});

test("eventos só da equipe vão só para admin; códigos de segurança só por e-mail", () => {
  for (const ev of EVENTOS_SO_EQUIPE) assert.deepEqual(MATRIZ_NOTIFICACOES[ev].papeis, ["admin"], ev);
  for (const ev of ["contract_signature_code", "recuperacao_2fa"] as const) {
    assert.equal(MATRIZ_NOTIFICACOES[ev].categoria, "seguranca");
    assert.deepEqual(MATRIZ_NOTIFICACOES[ev].canais, ["email"]);
  }
});

test("toda linha tem papel e canal, sem repetição", () => {
  for (const [ev, l] of linhas) {
    assert.ok(l.papeis.length > 0, ev);
    assert.ok(l.canais.length > 0, ev);
    assert.equal(new Set(l.papeis).size, l.papeis.length, ev);
    assert.equal(new Set(l.canais).size, l.canais.length, ev);
  }
});

test("a matriz ainda não muda o envio: notify() não a lê (o Prompt 44 liga)", () => {
  const notify = readFileSync(new URL("../lib/notifications/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(notify, /matriz-notificacoes/);
});
