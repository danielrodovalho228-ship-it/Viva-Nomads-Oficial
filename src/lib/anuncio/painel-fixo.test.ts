/** E528 (D14) — painel de preço do anúncio fixo SEM rolagem interna — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOPO_PAINEL_PRECO, painelCabe, topoDoPainel } from "./painel-fixo.ts";

test("cabe na janela: fica preso no topo de sempre (9 rem)", () => {
  assert.equal(TOPO_PAINEL_PRECO, 144);
  assert.equal(topoDoPainel(600, 900), 144);
});

test("mais alto que a janela: NÃO prende (rola com a página, inteiro) — prender pela base cortava cabeçalho e total", () => {
  assert.equal(topoDoPainel(1000, 800), null);
  assert.equal(painelCabe(1426, 1080), false, "o painel real mede ~1.400 px: não cabe em nenhuma janela comum");
});

test("no limite exato (altura + topo + folga = janela) ainda prende no topo", () => {
  assert.equal(topoDoPainel(900 - 144 - 16, 900), 144);
  assert.equal(topoDoPainel(900 - 144 - 15, 900), null);
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

test("o total por mês aparece de novo ao lado das ações, e o painel largo não prende (relative)", () => {
  const card = readFileSync(new URL("../../components/property/price-card.tsx", import.meta.url), "utf8");
  assert.match(card, /data-testid="total-junto-da-acao"[\s\S]*?formatBRL\(mes\.total\)[\s\S]*?\{actions\}/);
  const painel = readFileSync(new URL("../../components/property/painel-preco-fixo.tsx", import.meta.url), "utf8");
  assert.match(painel, /topo === null \? "relative" : "sticky"/);
});
