/*
  Pacote Clareza UX6 (ordem f1b437bb), item (b) — filtros em chips da caixa de mensagens.
  Roda: node --test src/lib/mensagens-filtros.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { FILTROS, type PapelConversa, papelDaConversa, filtrarConversas, contarPorFiltro, formatarPeriodo } from "./mensagens-filtros.ts";

const U = "user-1";

test("chips na ordem pedida (Prompt 32)", () => {
  assert.deepEqual(FILTROS.map((f) => f.rotulo), ["Todas", "Como proprietário", "Como morador", "Parceiros", "Falar com a Viva"]);
  assert.deepEqual(FILTROS.map((f) => f.id), ["todas", "proprietario", "inquilino", "parceiros", "suporte"]);
});

test("conversa de pedido de serviço (31b) cai em Parceiros, mesmo com imóvel", () => {
  assert.equal(papelDaConversa({ propertyId: "p1", donoDoImovelId: U, pedidoParceiroId: "ped-1" }, U), "parceiros");
});

test("conta que é dona e moradora: cada conversa no filtro certo", () => {
  const conversas = [
    { id: "meu-imovel", papel: papelDaConversa({ propertyId: "p1", donoDoImovelId: U }, U) },
    { id: "onde-moro", papel: papelDaConversa({ propertyId: "p2", donoDoImovelId: "dona" }, U) },
    { id: "fotografo", papel: papelDaConversa({ propertyId: "p1", donoDoImovelId: U, pedidoParceiroId: "x" }, U) },
    { id: "viva", papel: papelDaConversa({}, U) },
  ];
  assert.deepEqual(filtrarConversas(conversas, "proprietario").map((c) => c.id), ["meu-imovel"]);
  assert.deepEqual(filtrarConversas(conversas, "inquilino").map((c) => c.id), ["onde-moro"]);
  assert.deepEqual(filtrarConversas(conversas, "parceiros").map((c) => c.id), ["fotografo"]);
  assert.deepEqual(filtrarConversas(conversas, "suporte").map((c) => c.id), ["viva"]);
});

test("papel: imóvel meu = proprietário; imóvel de outro = inquilino; sem imóvel = suporte", () => {
  assert.equal(papelDaConversa({ propertyId: "p1", donoDoImovelId: U }, U), "proprietario");
  assert.equal(papelDaConversa({ propertyId: "p2", donoDoImovelId: "outro" }, U), "inquilino");
  assert.equal(papelDaConversa({ propertyId: undefined, donoDoImovelId: undefined }, U), "suporte");
});

test("filtra por chip e Todas devolve tudo", () => {
  const lista = [
    { id: "a", papel: "inquilino" as const },
    { id: "b", papel: "proprietario" as const },
    { id: "c", papel: "suporte" as const },
    { id: "d", papel: "inquilino" as const },
  ];
  assert.equal(filtrarConversas(lista, "todas").length, 4);
  assert.deepEqual(filtrarConversas(lista, "inquilino").map((c) => c.id), ["a", "d"]);
  assert.deepEqual(filtrarConversas(lista, "suporte").map((c) => c.id), ["c"]);
  assert.deepEqual(contarPorFiltro(lista), { todas: 4, inquilino: 2, proprietario: 1, parceiros: 0, suporte: 1 });
});

test("conversa sem papel conhecido aparece só em Todas", () => {
  const lista: { id: string; papel?: PapelConversa }[] = [{ id: "x" }];
  assert.equal(filtrarConversas(lista, "todas").length, 1);
  assert.equal(filtrarConversas(lista, "inquilino").length, 0);
});

test("período legível, ou vazio quando não há contrato", () => {
  assert.equal(formatarPeriodo("2026-11-13", "2027-02-15"), "13/11 – 15/02");
  assert.equal(formatarPeriodo(null, null), "");
});

import { readFileSync } from "node:fs";

test("ligação: a lista de conversas traz papel, foto e período e a tela tem os chips", () => {
  const dados = readFileSync(new URL("./data/messages.ts", import.meta.url), "utf8");
  assert.match(dados, /papelDaConversa/);
  assert.match(dados, /property_photos/);
  assert.match(dados, /contrato_blocos/);
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/mensagens/messages-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /mensagens-filtro-/);
  assert.match(tela, /filtrarConversas/);
});

// E168 (QA ao vivo do Muse, 25/10): filtro sem conversa → painel vazio, nunca a conversa de outro filtro.
test("E168 — a conversa aberta sai só do filtro (sem cair na 1ª conversa de todas)", () => {
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/mensagens/messages-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /const active = visiveis\.find\(\(c\) => c\.id === activeId\) \?\? visiveis\[0\];/);
  assert.doesNotMatch(tela, /\?\? conversations\[0\]/);
  assert.match(tela, /data-testid="mensagens-detalhe-vazio"/);
  assert.match(tela, /if \(conversations\.length === 0\) \{/, "\"Nenhuma conversa ainda\" só quando não há conversa nenhuma");
});
