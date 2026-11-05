/* Roda: node --test src/lib/anuncio/e511-lista-meus-imoveis.test.ts — E511: abas, busca, ordem e "Mostrar mais". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POR_PAGINA, abasVisiveis, contagemPorAba, filtrarEOrdenar, paginar, type ItemLista } from "./lista-meus-imoveis.ts";

const itens: ItemLista[] = [
  { id: "1", status: "active", title: "Studio Santa Mônica", neighborhood: "Santa Mônica", city: "Uberlândia", monthlyPrice: 3200 },
  { id: "2", status: "paused", title: "Casa no Tibery", neighborhood: "Tibery", city: "Uberlândia", monthlyPrice: 4100 },
  { id: "3", status: "draft", title: "Apartamento Centro", neighborhood: "Centro", city: "Uberlândia", monthlyPrice: 0 },
  { id: "4", status: "active", title: "Ático Umuarama", neighborhood: "Umuarama", city: "Uberlândia", monthlyPrice: 2800 },
];

test("E511: contagem por aba e só as abas com imóvel (Todos sempre)", () => {
  assert.deepEqual(contagemPorAba(itens), { todos: 4, active: 2, paused: 1, draft: 1 });
  assert.deepEqual(abasVisiveis(itens.filter((i) => i.status === "active")).map((a) => [a.id, a.n]), [["todos", 2], ["active", 2]]);
});

test("E511: aba e busca (título, bairro ou cidade; sem acento nem maiúsculas)", () => {
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "active", busca: "", ordem: "recentes" }).map((i) => i.id), ["1", "4"]);
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "santa monica", ordem: "recentes" }).map((i) => i.id), ["1"]);
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "ATICO", ordem: "recentes" }).map((i) => i.id), ["4"]);
  assert.equal(filtrarEOrdenar(itens, { aba: "paused", busca: "centro", ordem: "recentes" }).length, 0);
});

test("E511: ordem — recentes mantém a do servidor; nome A–Z; valor (sem valor vai para o fim)", () => {
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "", ordem: "recentes" }).map((i) => i.id), ["1", "2", "3", "4"]);
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "", ordem: "nome" }).map((i) => i.id), ["3", "4", "2", "1"]);
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "", ordem: "maior_valor" }).map((i) => i.id), ["2", "1", "4", "3"]);
  assert.deepEqual(filtrarEOrdenar(itens, { aba: "todos", busca: "", ordem: "menor_valor" }).map((i) => i.id), ["4", "1", "2", "3"]);
});

test("E511: 27 cartões viram 12 à vista e 'Mostrar mais' com o que falta", () => {
  const muitos = Array.from({ length: 27 }, (_, i) => i);
  assert.equal(POR_PAGINA, 12);
  assert.deepEqual([paginar(muitos, 1).visiveis.length, paginar(muitos, 1).restantes], [12, 15]);
  assert.deepEqual([paginar(muitos, 2).visiveis.length, paginar(muitos, 2).restantes], [24, 3]);
  assert.deepEqual([paginar(muitos, 3).visiveis.length, paginar(muitos, 3).restantes], [27, 0]);
});

test("E511: a tela usa a barra (abas, busca, ordem) e o 'Mostrar mais'", () => {
  const c = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", import.meta.url), "utf8");
  for (const id of ["imoveis-abas", "imoveis-busca", "imoveis-ordem", "imoveis-mostrar-mais", "imoveis-sem-resultado"]) assert.match(c, new RegExp(`data-testid="${id}"`), id);
  assert.match(c, /filtrarEOrdenar\(/);
  assert.match(c, /paginar\(/);
});
