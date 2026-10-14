/*
  Pacote Clareza UX6 (ordem f1b437bb), item (b) — filtros em chips da caixa de mensagens.
  Roda: node --test src/lib/mensagens-filtros.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { FILTROS, type PapelConversa, papelDaConversa, filtrarConversas, contarPorFiltro, formatarPeriodo } from "./mensagens-filtros.ts";

const U = "user-1";

test("chips na ordem pedida", () => {
  assert.deepEqual(FILTROS.map((f) => f.rotulo), ["Todas", "Como inquilino", "Como proprietário", "Suporte"]);
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
  assert.deepEqual(contarPorFiltro(lista), { todas: 4, inquilino: 2, proprietario: 1, suporte: 1 });
});

test("conversa sem papel conhecido aparece só em Todas", () => {
  const lista: { id: string; papel?: PapelConversa }[] = [{ id: "x" }];
  assert.equal(filtrarConversas(lista, "todas").length, 1);
  assert.equal(filtrarConversas(lista, "inquilino").length, 0);
});

test("período legível, ou vazio quando não há contrato", () => {
  assert.equal(formatarPeriodo("2026-11-01", "2027-01-30"), "01 nov – 30 jan");
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
