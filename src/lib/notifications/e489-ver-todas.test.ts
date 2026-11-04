/*
  E489 — o "Ver todas" do sino abria as PREFERÊNCIAS de notificação, não a lista de avisos.
  Causa: o link é /dashboard/notificacoes#avisos e a lista fica abaixo das preferências; no computador, quem rola é o
  <main> do painel (lg:h-screen + overflow-hidden; main overflow-y-auto), não a janela — a âncora não levava à lista
  e a pessoa via as preferências. Correção (mesmo link, sem mexer no sino nem nos testes que o fixam): ao chegar com
  #avisos (ou trocar para ele na mesma página), a seção da lista rola para a vista dentro do container certo e o
  foco vai para o título "Avisos recentes".
  Roda: node --test src/lib/notifications/e489-ver-todas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VER_TODAS } from "./sino.ts";
import { deveIrParaAvisos } from "./ir-para-avisos.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("o link do sino continua o mesmo e aponta para a âncora da lista", () => {
  assert.equal(VER_TODAS, "/dashboard/notificacoes#avisos");
});

test("puro: só a âncora da lista dispara a ida (com ou sem filtro na URL)", () => {
  assert.equal(deveIrParaAvisos("#avisos"), true);
  assert.equal(deveIrParaAvisos(""), false);
  assert.equal(deveIrParaAvisos("#outra"), false);
});

test("a página monta o componente que leva à lista e foca o título", () => {
  const p = ler("src/app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(p, /<IrParaAvisos alvo="avisos" titulo="h-avisos" \/>/);
  assert.match(p, /tabIndex=\{-1\}/);
  const c = ler("src/components/account/ir-para-avisos.tsx");
  assert.match(c, /^"use client";/);
  assert.match(c, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(c, /addEventListener\("hashchange", ir\)/);
  assert.match(c, /\.focus\(\{ preventScroll: true \}\)/);
});
