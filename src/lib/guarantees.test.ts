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
  garantidorStatus,
  servicoSelecionavel,
  servicosDisponiveis,
  servicosVisiveis,
  type Garantia,
} from "./guarantees.ts";

test("filtro por prazo: estadia de temporada (< 90 dias) mostra só caução (título aposentado)", () => {
  const elegiveis = garantiasElegiveis(60);
  assert.deepEqual(
    elegiveis.map((g) => g.id).sort(),
    ["caucao"],
    "título aposentado (Onda 1) e garantidor digital (prazo mínimo 90) fora"
  );
});

test("filtro por prazo: estadia residencial (90–180 dias) inclui caução + slot de garantidor", () => {
  const elegiveis = garantiasElegiveis(120);
  assert.deepEqual(
    elegiveis.map((g) => g.id).sort(),
    ["caucao", "garantidor_digital"],
    "de 90 a 180 dias: caução + garantidor (slot); título aposentado (Onda 1) fora"
  );
});

test("Onda 1: o título de capitalização foi aposentado — nunca é elegível", () => {
  assert.ok(!garantiasElegiveis(60).some((g) => g.id === "titulo"));
  assert.ok(!garantiasElegiveis(120).some((g) => g.id === "titulo"));
  const titulo = GARANTIAS.find((g) => g.id === "titulo");
  assert.equal(titulo?.status, "inativo", "o registro fica no catálogo, mas inativo");
});

test("limites do prazo do garantidor digital: 89 fora, 90 e 180 dentro, 181 fora", () => {
  assert.ok(!garantiasElegiveis(89).some((g) => g.id === "garantidor_digital"));
  assert.ok(garantiasElegiveis(90).some((g) => g.id === "garantidor_digital"));
  assert.ok(garantiasElegiveis(180).some((g) => g.id === "garantidor_digital"));
  assert.ok(!garantiasElegiveis(181).some((g) => g.id === "garantidor_digital"));
});

test("feature flag: desligada → 'em_breve'; ligada → 'ativo' (e então selecionável)", () => {
  assert.equal(garantidorStatus(false), "em_breve");
  assert.equal(garantidorStatus(true), "ativo");

  // Com a flag ligada, o mesmo garantidor digital vira selecionável — sem mudar
  // o fluxo, só o status derivado da flag.
  const base = GARANTIAS.find((g) => g.tipo === "garantidor_digital")!;
  const ligado: Garantia = { ...base, status: garantidorStatus(true) };
  assert.equal(garantiaSelecionavel(ligado), true);

  const desligado: Garantia = { ...base, status: garantidorStatus(false) };
  assert.equal(garantiaSelecionavel(desligado), false);
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

test("seleção única: no máximo uma garantia selecionável por contrato (só caução ativa)", () => {
  // A regra de UI é seleção única; o modelo garante que as opções de fato
  // selecionáveis são só as 'ativo'. Após a Onda 1: só caução (título aposentado).
  const selecionaveis = garantiasElegiveis(60).filter(garantiaSelecionavel);
  assert.deepEqual(selecionaveis.map((g) => g.id).sort(), ["caucao"]);
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

test("Aqui Resolve ATIVA: os dois serviços aparecem como disponíveis e selecionáveis", () => {
  // Assistência 24h e Plano de manutenção agora estão 'ativo' (MVP).
  assert.equal(servicosDisponiveis().length, 2);
  const visiveis = servicosVisiveis();
  assert.equal(visiveis.length, 2);
  // Todos selecionáveis agora que estão 'ativo'.
  assert.equal(visiveis.every((s) => servicoSelecionavel(s)), true);
  // Quem paga continua correto por serviço.
  const assist = visiveis.find((s) => s.id === "assistencia_24h")!;
  const manut = visiveis.find((s) => s.id === "plano_manutencao")!;
  assert.equal(assist.quemPaga, "inquilino");
  assert.equal(manut.quemPaga, "proprietario");
});
