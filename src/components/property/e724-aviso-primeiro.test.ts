// E724 (Phoenix/RELATORIO-002, A3): no cartão de preço do anúncio de exemplo, o aviso vem antes do valor, das datas e do total.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/components/property/price-card.tsx", "utf8");

test("E724: o aviso do exemplo é o PRIMEIRO elemento do cartão de preço (antes do preço)", () => {
  const aviso = s.indexOf('data-testid="cartao-exemplo-aviso"');
  const preco = s.indexOf('data-testid="cartao-lateral-preco"');
  const acoes = s.indexOf("{actions}");
  assert.ok(aviso > 0 && aviso < preco && preco < acoes, "aviso → preço → ações");
  assert.match(s, /isExemplo\(property\.id\) && \(/);
  assert.match(s, /Nenhuma solicitação é enviada a ninguém/);
});
