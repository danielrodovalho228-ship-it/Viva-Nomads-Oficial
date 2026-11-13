/*
  E823 — o botão flutuante de chat (o redondo, C1b) se identifica: rótulo visível ao passar o mouse ou focar pelo
  teclado, title e nome acessível — "Fale com a Viva · chat de atendimento".
  Roda: node --test src/components/ajuda/e823-botao-chat-rotulo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./viva-chat.tsx", import.meta.url), "utf8");

test("o texto do rótulo diz o que o botão abre", () => {
  assert.match(fonte, /export const ROTULO_BOTAO_VIVA = "Fale com a Viva · chat de atendimento";/);
});

test("o botão redondo tem title e nome acessível", () => {
  assert.match(fonte, /title=\{aberto \? "Fechar o chat" : ROTULO_BOTAO_VIVA\}/);
  assert.match(fonte, /aria-label=\{aberto \? "Fechar o chat" : "Fale com a Viva"\}/);
});

test("rótulo VISÍVEL ao passar o mouse e ao focar pelo teclado (sem voltar a cobrir o conteúdo)", () => {
  const i = fonte.indexOf('data-testid="fale-com-a-viva-rotulo"');
  assert.ok(i > 0);
  const bloco = fonte.slice(fonte.lastIndexOf("<span", i), i);
  assert.match(bloco, /peer-hover:block/);
  assert.match(bloco, /peer-focus-visible:block/);
  assert.match(bloco, /hidden/);
  // O botão é o "peer" (vem ANTES do rótulo no DOM; o rótulo sobe por order-first).
  assert.ok(fonte.indexOf('data-testid="fale-com-a-viva"') < i);
  assert.match(fonte, /"peer h-12 touch-none/);
});
