/*
  Estabilidade (02/11, Pista A): Conta › Notificações carregava com dois blocos de 224 px que viravam cartões de ~420 px
  e empurravam "Avisos recentes" (salto de layout 0,13 no celular). Agora, carregando, a mesma tela (títulos e textos
  fixos) com um trilho neutro no lugar de cada interruptor — nunca um estado ligado/desligado ainda não lido — e o
  "Salvar preferências" desabilitado.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const t = readFileSync(new URL("../../components/account/tela-notificacoes.tsx", import.meta.url), "utf8");

test("carregando: a mesma estrutura, trilho neutro no lugar do interruptor, Salvar desabilitado", () => {
  assert.doesNotMatch(t, /className="block h-56 rounded-xl bg-white"/);
  assert.match(t, /const carregando = !tipos \|\| !canais;/);
  assert.match(t, /data-testid=\{carregando \? "tela-notificacoes-carregando" : "tela-notificacoes"\}/);
  assert.match(t, /\{tipos \? <Switch checked=\{tipos\[t\.categoria\]\}[\s\S]*?\/> : trilho\}/);
  assert.match(t, /\{canais \? <Switch checked=\{canais\[c\.canal\]\}[\s\S]*?\/> : trilho\}/);
  assert.match(t, /disabled=\{salvando \|\| carregando\}/);
});
