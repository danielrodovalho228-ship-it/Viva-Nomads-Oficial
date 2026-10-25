/*
  /admin/pedidos (ordem 63c50a8c, F20): busca e abas por status, só no que já está na lista.
  Roda: node --test src/lib/admin/pedidos-filtro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { abasPedidos, filtrarPedidosAdmin, type PedidoFiltravel } from "./pedidos-filtro.ts";

const p = (id: string, status: string, nome: string | null, cidade = "Uberlândia", bairros: string[] | null = null): PedidoFiltravel => ({
  id,
  status,
  cidade,
  bairros,
  motivo: "trabalho",
  colunas: nome ? { nome } : null,
});
const lista = [p("1", "ativo", "Maria Silva"), p("2", "ativo", "João Souza", "São Paulo", ["Pinheiros"]), p("3", "removido_admin", "Ana Lima"), p("4", "expirado", null)];

test("sem busca e na aba 'todos' devolve tudo", () => {
  assert.equal(filtrarPedidosAdmin(lista, { q: "", aba: "todos" }).length, 4);
});
test("aba filtra pelo status", () => {
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "", aba: "ativo" }).map((x) => x.id), ["1", "2"]);
});
test("busca ignora maiúsculas e acentos, em nome, cidade e bairro", () => {
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "JOAO", aba: "todos" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "uberlandia", aba: "todos" }).map((x) => x.id), ["1", "3", "4"]);
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "pinheiros", aba: "todos" }).map((x) => x.id), ["2"]);
});
test("busca e aba combinam; sem resultado devolve lista vazia", () => {
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "ana", aba: "ativo" }), []);
});
test("pedido sem nome não quebra a busca", () => {
  assert.deepEqual(filtrarPedidosAdmin(lista, { q: "zzz", aba: "todos" }), []);
});
test("abas trazem só status que existem, com contagem e 'Todos' primeiro", () => {
  const abas = abasPedidos(lista);
  assert.deepEqual(abas.map((a) => [a.valor, a.total]), [["todos", 4], ["ativo", 2], ["removido_admin", 1], ["expirado", 1]]);
});
