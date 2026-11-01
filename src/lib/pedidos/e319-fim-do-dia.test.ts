import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataPedidoBR } from "./campos.ts";

test("E319: o cartão do pedido do morador diz 'Fica no ar até o fim do dia …' (a data por extenso: e319-por-extenso)", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/pedidos/pedidos-client.tsx", import.meta.url), "utf8");
  assert.match(src, /`Fica no ar até o fim do dia \$\{/);
  assert.doesNotMatch(src, /"Fica no ar até"\}/);
});

test("E319: a data é o dia de Brasília — 23:59:59 BRT ainda é o mesmo dia", () => {
  // 23:59:59 de 06/11 em Brasília = 02:59:59Z de 07/11.
  assert.equal(dataPedidoBR("2026-11-07T02:59:59Z"), "06/11/2026");
});
