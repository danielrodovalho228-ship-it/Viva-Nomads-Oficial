/*
  Prompt 58 — regras puras da eliminação.
  Roda: node --test src/lib/minimizacao/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { aReaplicar, eliminaDeVerdade, planoDoItem, rodadaSimulada, textoPrazo, venceu, type ItemInventario } from "./regras.ts";

const docCandidatura: ItemInventario = {
  id: "inquilino-docs/arquivo",
  origem: "bucket:inquilino-docs",
  dado: "imagem do documento da candidatura",
  finalidade: "conferência pelo admin",
  prazoDias: 30,
  gatilho: "decisao_admin",
  modo: "apagar",
  base: "proposta",
  fase: 1,
  fica: "veredito (tipo, decisão, data, quem decidiu)",
};
const mensagens: ItemInventario = { ...docCandidatura, id: "messages", origem: "public.messages", prazoDias: null, gatilho: "fim_janela_disputa", base: "pendente", fase: 2 };

test("regra 2a: 30 dias † depois da decisão — dia 29 e 30 ficam, dia 31 sai", () => {
  const decisao = "2026-10-01T15:00:00Z";
  assert.equal(venceu(30, decisao, new Date("2026-10-30T15:00:00Z")), false); // dia 29
  assert.equal(venceu(30, decisao, new Date("2026-10-31T16:00:00Z")), false); // dia 30
  assert.equal(venceu(30, decisao, new Date("2026-11-01T15:00:01Z")), true); // dia 31
  assert.equal(venceu(null, decisao, new Date("2030-01-01")), false, "prazo pendente nunca vence");
  assert.equal(venceu(30, null, new Date("2030-01-01")), false, "sem decisão ainda, nada vence");
});

test("real só na fase 1 com prazo definido e base que não depende do jurídico; o resto é simulado (não apaga nada)", () => {
  assert.equal(eliminaDeVerdade(docCandidatura), true);
  assert.equal(eliminaDeVerdade(mensagens), false);
  assert.equal(eliminaDeVerdade({ ...docCandidatura, base: "pendente" }), false);
  assert.equal(eliminaDeVerdade({ ...docCandidatura, fase: 2 }), false);
  const agora = new Date("2026-11-15T00:00:00Z");
  const c = [
    { ref: "a.png", desde: "2026-10-01T00:00:00Z" },
    { ref: "b.png", desde: "2026-11-10T00:00:00Z" },
    { ref: "t.png", desde: "2026-10-01T00:00:00Z", teste: true },
  ];
  assert.deepEqual(planoDoItem(docCandidatura, c, agora), { item: "inquilino-docs/arquivo", real: true, eliminar: ["a.png", "t.png"], quantidade: 1, quantidadeTeste: 1 });
  const sim = planoDoItem({ ...docCandidatura, fase: 2 }, c, agora);
  assert.equal(sim.real, false);
  assert.deepEqual(sim.eliminar, [], "simulado nunca devolve o que apagar");
  assert.equal(sim.quantidade, 1);
});

test("texto do prazo: † na proposta; pendente aponta o item 13", () => {
  assert.equal(textoPrazo(docCandidatura), "30 dias depois da decisão do admin †");
  assert.equal(textoPrazo(mensagens), "pendente – item 13 da Dra. Beatriz");
  assert.equal(textoPrazo({ prazoDias: 0, base: "proposta", gatilho: "sinal_processado" }), "na hora depois de processado o sinal †");
});

test("restauração: o livro reaplicado acha o que voltou; depois de reaplicar, nada volta", () => {
  const livro = [
    { origem: "bucket:inquilino-docs", ref_id: "u1/rg.png" },
    { origem: "public.internet_medicoes", ref_id: "m1" },
  ];
  const voltou = new Map([["bucket:inquilino-docs", new Set(["u1/rg.png", "u2/outro.png"])]]);
  assert.deepEqual(aReaplicar(livro, voltou), [{ origem: "bucket:inquilino-docs", ref: "u1/rg.png" }]);
  assert.deepEqual(aReaplicar(livro, new Map()), []);
});

test("a rodada só apaga de verdade com a chave ligada (ou no laboratório); pedido de simulação nunca apaga", () => {
  assert.equal(rodadaSimulada({ pedidoSimular: false, laboratorio: false, chaveAtiva: undefined }), true, "produção sem chave: simulado");
  assert.equal(rodadaSimulada({ pedidoSimular: false, laboratorio: false, chaveAtiva: "0" }), true);
  assert.equal(rodadaSimulada({ pedidoSimular: false, laboratorio: false, chaveAtiva: "1" }), false, "chave ligada: real");
  assert.equal(rodadaSimulada({ pedidoSimular: false, laboratorio: true, chaveAtiva: undefined }), false, "laboratório: real");
  assert.equal(rodadaSimulada({ pedidoSimular: true, laboratorio: true, chaveAtiva: "1" }), true, "pedido de simulação: nunca apaga");
});
