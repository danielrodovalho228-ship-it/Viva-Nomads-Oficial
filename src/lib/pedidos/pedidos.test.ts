/*
  Testes das regras puras do Pedido de Moradia (filtro anti-contato, expiração).
  Roda com: node --experimental-strip-types --test src/lib/pedidos/pedidos.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectarContato,
  contemContato,
  calcExpiraEm,
  motivoPublico,
  MAX_PEDIDOS_ATIVOS,
} from "./pedidos.ts";

test("anti-contato bloqueia telefone (com e sem máscara)", () => {
  assert.equal(detectarContato("me liga 34 99999-8888"), "telefone");
  assert.equal(detectarContato("meu numero 34999998888"), "termo"); // "meu numero" pega antes
  assert.equal(contemContato("34 99999 8888"), true);
});

test("anti-contato bloqueia e-mail", () => {
  assert.equal(detectarContato("meu email joao@gmail.com"), "email");
});

test("anti-contato bloqueia termos de mensageria", () => {
  assert.equal(detectarContato("me chama no zap"), "termo");
  assert.equal(detectarContato("chama no whats"), "termo");
  assert.equal(detectarContato("te chamo no telegram"), "termo");
});

test("anti-contato bloqueia link de mensageria", () => {
  assert.equal(detectarContato("https://wa.me/5534999998888"), "mensageria");
});

test("texto limpo passa", () => {
  assert.equal(detectarContato("Sou médica, começo residência em março e preciso de 6 meses."), null);
  assert.equal(contemContato("Família de 3, buscando algo perto do centro."), false);
});

test("não bloqueia números curtos (CEP, valores)", () => {
  assert.equal(detectarContato("orçamento até 3500 por mês, CEP 38400"), null);
});

test("expiração = menor entre data_inicio+15 e criado_em+60", () => {
  // início logo (em 5 dias) → data_inicio+15 vence antes que criado+60.
  assert.equal(calcExpiraEm("2026-07-10", "2026-07-05"), "2026-07-25");
  // início distante → criado_em+60 vence antes.
  assert.equal(calcExpiraEm("2026-12-01", "2026-07-05"), "2026-09-03");
});

test("motivo público não identifica a pessoa", () => {
  assert.equal(motivoPublico("trabalho_saude"), "Profissional da saúde");
  assert.equal(MAX_PEDIDOS_ATIVOS, 2);
});
