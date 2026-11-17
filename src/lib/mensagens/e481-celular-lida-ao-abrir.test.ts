/*
  E481 no celular (decisão do Gerente, DUET-0605): a conversa só conta como lida quando a pessoa a abre e vê. No
  computador a vista dividida mostra a conversa aberta ao lado da lista; no celular a lista não mostra conteúdo nenhum.
  Antes, a 390 px, a conversa do topo era marcada como lida só por carregar a lista — o "não lido" sumia sem a pessoa
  ter visto nada. Carregar a lista não marca leitura; abrir a conversa, sim.
  Roda: node --test src/lib/mensagens/e481-celular-lida-ao-abrir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversaNaTela, VISTA_DIVIDIDA } from "./conversa-na-tela.ts";

test("celular, só a lista na tela: nenhuma conversa conta como vista (carregar a lista não marca leitura)", () => {
  assert.equal(conversaNaTela({ ativaId: "c1", vistaDividida: false, vistaCelular: "list" }), null);
});

test("celular, conversa aberta: ela conta como vista", () => {
  assert.equal(conversaNaTela({ ativaId: "c1", vistaDividida: false, vistaCelular: "chat" }), "c1");
});

test("computador (vista dividida): a conversa aberta ao lado da lista conta como vista, como antes", () => {
  assert.equal(conversaNaTela({ ativaId: "c1", vistaDividida: true, vistaCelular: "list" }), "c1");
  assert.equal(conversaNaTela({ ativaId: undefined, vistaDividida: true, vistaCelular: "list" }), null);
});

test("a vista dividida é a do breakpoint md da tela (768 px), o mesmo que esconde a lista no celular", () => {
  assert.equal(VISTA_DIVIDIDA, "(min-width: 768px)");
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx", import.meta.url), "utf8");
  // A marcação de lida (e o "conversa aberta" do push) usa só a conversa que está NA TELA.
  assert.match(tela, /const conversaAbertaId = conversaNaTela\(\{ ativaId: active\?\.id, vistaDividida, vistaCelular: mobileView \}\);/);
  assert.doesNotMatch(tela, /const conversaAbertaId = active\?\.id;/);
});
