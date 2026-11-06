/* Roda: node --test src/lib/pedidos/e370-validade-sempre.test.ts
  E370: o formulário do pedido mostra a regra de validade desde o início (30 dias, nunca antes da entrada, renova com um clique)
  e só ganha o cálculo (a data) quando a entrada é digitada. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync("src/app/(public)/pedidos/novo/page.tsx", "utf8");

test("E370: a validade não depende mais de a data de entrada existir", () => {
  assert.doesNotMatch(tela, /\{dataInicio && \(\s*<p className="text-\[13px\] text-muted" data-testid="pedido-validade">/);
  assert.match(tela, /data-testid="pedido-validade" data-calculada=\{dataInicio \? "1" : "0"\}/);
});

test("E370: sem data diz a regra; com data diz até quando", () => {
  assert.match(tela, /Seu pedido fica no ar por <strong className="text-ink">30 dias<\/strong> depois de publicar/);
  assert.match(tela, /Ao escolher a entrada, mostramos a data exata\./);
  assert.match(tela, /Seu pedido fica no ar até <strong className="text-ink">\{dataPedidoBR\(expiraEmPedido\(dataInicio,/);
});
