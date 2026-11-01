import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataPedidoBR, dataPedidoPorExtenso } from "./campos.ts";

test("E319 (devolução): a data por extenso, no dia de Brasília", () => {
  // 23:59:59 de 01/03/2027 em Brasília = 02:59:59Z de 02/03.
  assert.equal(dataPedidoPorExtenso("2027-03-02T02:59:59Z"), "1º de março de 2027");
  assert.equal(dataPedidoBR("2027-03-02T02:59:59Z"), "01/03/2027", "o dia é o mesmo; só a forma muda");
  assert.equal(dataPedidoPorExtenso("2026-11-07T02:59:59Z"), "6 de novembro de 2026");
  assert.equal(dataPedidoPorExtenso(null), "");
});

test("E319: o cartão diz 'Fica no ar até o fim do dia' + data por extenso", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/pedidos/pedidos-client.tsx", import.meta.url), "utf8");
  assert.match(src, /`Fica no ar até o fim do dia \$\{dataPedidoPorExtenso\(p\.expira_em\)\}`/);
});
