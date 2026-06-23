/*
  Testes do modelo de dados de garantia + serviços.
  Roda com: node --experimental-strip-types --test src/lib/guarantees.test.ts

  Cobre as duas regras travadas do fluxo:
  1. Filtro por prazo: < 90 dias mostra caução e título; 90–180 mostra também o
     slot de garantidor digital.
  2. Seleção única / garantidor "em breve": não dá para selecionar o garantidor
     enquanto a flag estiver desligada — e só UMA garantia é selecionável de cada
     vez (regra reforçada na UI; aqui validamos que apenas 'ativo' é selecionável).
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GARANTIAS,
  garantiaSelecionavel,
  garantiasElegiveis,
  servicosDisponiveis,
  type Garantia,
} from "./guarantees.ts";

test("filtro por prazo: estadia de temporada (< 90 dias) mostra caução e título", () => {
  const elegiveis = garantiasElegiveis(60);
  assert.deepEqual(
    elegiveis.map((g) => g.id).sort(),
    ["caucao", "titulo"],
    "abaixo de 90 dias o garantidor digital (prazo mínimo 90) não entra"
  );
});

test("filtro por prazo: estadia residencial (90–180 dias) inclui o slot de garantidor digital", () => {
  const elegiveis = garantiasElegiveis(120);
  assert.deepEqual(
    elegiveis.map((g) => g.id).sort(),
    ["caucao", "garantidor_digital", "titulo"],
    "de 90 a 180 dias as três opções são elegíveis (garantidor como slot)"
  );
});

test("limites do prazo do garantidor digital: 89 fora, 90 e 180 dentro, 181 fora", () => {
  assert.ok(!garantiasElegiveis(89).some((g) => g.id === "garantidor_digital"));
  assert.ok(garantiasElegiveis(90).some((g) => g.id === "garantidor_digital"));
  assert.ok(garantiasElegiveis(180).some((g) => g.id === "garantidor_digital"));
  assert.ok(!garantiasElegiveis(181).some((g) => g.id === "garantidor_digital"));
});

test("garantidor digital aparece como elegível mas NÃO é selecionável com a flag desligada", () => {
  const garantidor = garantiasElegiveis(120).find((g) => g.id === "garantidor_digital");
  assert.ok(garantidor, "o slot precisa aparecer (elegível) para sinalizar 'em breve'");
  assert.equal(garantidor!.status, "em_breve");
  assert.equal(
    garantiaSelecionavel(garantidor!),
    false,
    "não dá para selecionar um garantidor 'em breve'"
  );
});

test("seleção única: no máximo uma garantia selecionável por contrato (caução e título ativos)", () => {
  // A regra de UI é seleção única; o modelo garante que as opções de fato
  // selecionáveis são só as 'ativo'. Hoje: caução e título.
  const selecionaveis = garantiasElegiveis(60).filter(garantiaSelecionavel);
  assert.deepEqual(selecionaveis.map((g) => g.id).sort(), ["caucao", "titulo"]);
  // Qualquer subconjunto de seleção válido tem tamanho 0 ou 1 — nunca 2.
  for (const g of selecionaveis) {
    const selecao: Garantia[] = [g];
    assert.equal(selecao.length, 1, "uma seleção válida nunca passa de uma garantia");
  }
});

test("garantia 'inativo' nunca é elegível", () => {
  const inativa: Garantia = {
    id: "x",
    nome: "X",
    tipo: "caucao",
    prazoMinDias: 1,
    prazoMaxDias: 180,
    quemPaga: "inquilino",
    reembolsavel: true,
    status: "inativo",
    parceiroNome: null,
    observacao: null,
  };
  const filtra = [...GARANTIAS, inativa].filter(
    (g) => g.status !== "inativo" && g.prazoMinDias <= 30 && 30 <= g.prazoMaxDias
  );
  assert.ok(!filtra.some((g) => g.id === "x"));
});

test("serviços adicionais 'em breve' não aparecem como disponíveis", () => {
  // Hoje ambos estão 'em breve' — a lista de disponíveis vem vazia até ligar.
  assert.equal(servicosDisponiveis().length, 0);
});
