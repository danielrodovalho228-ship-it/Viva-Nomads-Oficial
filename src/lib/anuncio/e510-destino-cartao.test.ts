/* Roda: node --test src/lib/anuncio/e510-destino-cartao.test.ts — E510: foto e título do cartão clicáveis em todo estado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoDoCartao } from "./destino-cartao.ts";

test("E510: o destino da foto e do título é o mesmo dos botões do cartão, por estado", () => {
  assert.equal(destinoDoCartao({ id: "a1", status: "active", retomar: "/x" }), "/imoveis/a1");
  assert.equal(destinoDoCartao({ id: "a1", status: "paused", retomar: "/x" }), "/dashboard/imoveis/a1/editar");
  assert.equal(destinoDoCartao({ id: "a1", status: "draft", retomar: "/dashboard/imoveis/novo?draft=a1&etapa=endereco" }), "/dashboard/imoveis/novo?draft=a1&etapa=endereco");
});

test("E510: no cartão, a foto e o título são links para destinoDoCartao em todo estado (não só no ativo)", () => {
  const c = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", import.meta.url), "utf8");
  assert.match(c, /const destino = destinoDoCartao\(\{ id: p\.id, status: p\.status, retomar: hrefRetomarRascunho\(prontidao\[p\.id\], p\.id\) \}\);/);
  assert.match(c, /data-testid="cartao-foto-link"/);
  assert.match(c, /data-testid="cartao-titulo-link"/);
  // O título não volta a ser texto puro para pausado e rascunho.
  assert.doesNotMatch(c, /demoItem \|\| p\.status !== "active" \? \(/);
});
