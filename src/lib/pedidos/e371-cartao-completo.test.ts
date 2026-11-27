/* Roda: node --test src/lib/pedidos/e371-cartao-completo.test.ts
  E371: o cartão do pedido publicado (Meus pedidos) mostra tudo o que a pessoa digitou: internet mínima, destino, transporte e o tempo até lá. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoDestinoPedido, textoInternetPedido } from "./campos.ts";

test("E371: destino + transporte + tempo numa frase só", () => {
  assert.equal(textoDestinoPedido({ rotulo: "UFU Santa Mônica", modo_preferido: "carro", ate: 15 }), "UFU Santa Mônica · de carro · até 15 min");
  assert.equal(textoDestinoPedido({ rotulo: "UFU Santa Mônica", modo_preferido: "a_pe", ate: 0 }), "UFU Santa Mônica · a pé");
  assert.equal(textoDestinoPedido({ rotulo: "HC-UFU", modo_preferido: "onibus", ate: 30 }), "HC-UFU · de ônibus · até 30 min");
});

test("E371: sem rótulo ou sem destino, nada (o transporte e o tempo sozinhos não dizem para onde)", () => {
  assert.equal(textoDestinoPedido(null), null);
  assert.equal(textoDestinoPedido({ rotulo: "  ", modo_preferido: "carro", ate: 10 }), null);
  assert.equal(textoDestinoPedido({ modo_preferido: "carro" }), null);
});

test("E371: a internet mínima já tem frase", () => {
  assert.equal(textoInternetPedido(100), "Internet medida 100+ Mbps");
  assert.equal(textoInternetPedido(null), null);
});

test("E371: o cartão 'meu pedido' usa as três frases", () => {
  const tela = readFileSync("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx", "utf8");
  assert.match(tela, /textoInternetPedido\(p\.internet_min_mbps\)/);
  assert.match(tela, /textoDestinoPedido\(p\.destino\)/);
  assert.match(tela, /data-testid="meu-pedido-destino"/);
  assert.match(tela, /internet_min_mbps\?: number \| null;/);
});
