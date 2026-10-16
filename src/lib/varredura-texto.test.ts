/* Roda: node --test src/lib/varredura-texto.test.ts */
import assert from "node:assert/strict";
import { test } from "node:test";
import { achadosNoTexto, rotaVarreTermos } from "./varredura-texto.ts";

test("tela limpa não tem achados", () => {
  assert.deepEqual(achadosNoTexto("Valor mensal R$ 3.000. Entrada em 12/11/2026. Código 1a2b3c4d. Aguardando aceite. Conferência de saída."), []);
});

test("pega termos proibidos, com e sem acento", () => {
  for (const t of ["o aluguel", "Aluguéis", "taxa de comissão", "comissao", "vistoria de saída", "corretagem", "intermediação", "intermedeia", "temporada", "art. 48"]) {
    assert.equal(achadosNoTexto(t).length, 1, t);
  }
  assert.deepEqual(achadosNoTexto("Aluguel", { termos: false }), []);
});

test("pega status cru, data ISO, UUID e undefined/NaN", () => {
  assert.equal(achadosNoTexto("Situação: pendente_aceite").length, 1);
  assert.equal(achadosNoTexto("aguardando_assinatura e em_andamento").length, 2);
  assert.equal(achadosNoTexto("Início 2026-11-12").length, 1);
  assert.equal(achadosNoTexto("Criado 2026-11-12T10:30:00").length, 1);
  assert.equal(achadosNoTexto("Contrato 3f2504e0-4f89-11d3-9a0c-0305e82c3301").length, 1);
  assert.equal(achadosNoTexto("Valor: undefined").length, 1);
  assert.equal(achadosNoTexto("R$ NaN").length, 1);
});

test("não confunde palavras comuns", () => {
  assert.deepEqual(achadosNoTexto("Anunciar em andamento. Em breve. Nullable"), []);
  assert.equal(achadosNoTexto("Valor null aqui").length, 1);
});

test("/termos, /privacidade e contratos ficam fora da varredura de termos", () => {
  assert.equal(rotaVarreTermos("/termos"), false);
  assert.equal(rotaVarreTermos("/privacidade?x=1"), false);
  assert.equal(rotaVarreTermos("/como-funciona"), true);
});
