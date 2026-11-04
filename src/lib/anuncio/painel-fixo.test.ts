/** E528 (D14) — painel de preço do anúncio fixo SEM rolagem interna — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOPO_PAINEL_PRECO, topoDoPainel } from "./painel-fixo.ts";

test("cabe na janela: fica preso no topo de sempre (9 rem)", () => {
  assert.equal(TOPO_PAINEL_PRECO, 144);
  assert.equal(topoDoPainel(600, 900), 144);
});

test("mais alto que a janela: o 'top' fica negativo — o painel rola com a página até a BASE aparecer e prende pela base", () => {
  // 1000 px de painel numa janela de 800: prende quando a base está 16 px acima do fim da janela
  assert.equal(topoDoPainel(1000, 800), 800 - 1000 - 16);
  // a base presa fica sempre dentro da janela, com a folga
  const top = topoDoPainel(1000, 800);
  assert.equal(top + 1000, 800 - 16);
});

test("no limite exato (altura + topo + folga = janela) ainda prende no topo", () => {
  assert.equal(topoDoPainel(900 - 144 - 16, 900), 144);
  assert.equal(topoDoPainel(900 - 144 - 15, 900), 900 - (900 - 144 - 15) - 16);
});

test("o cartão de preço não tem mais rolagem interna nem altura máxima; usa o painel fixo", () => {
  const card = readFileSync(new URL("../../components/property/price-card.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /overflow-y-auto/, "antes: lg:overflow-y-auto (rolagem própria cortando topo e base)");
  assert.doesNotMatch(card, /max-h-\[calc\(100dvh/);
  assert.match(card, /<PainelPrecoFixo>/);
  const painel = readFileSync(new URL("../../components/property/painel-preco-fixo.tsx", import.meta.url), "utf8");
  assert.match(painel, /^"use client";/);
  assert.match(painel, /topoDoPainel\(/);
  assert.match(painel, /new ResizeObserver/);
});
