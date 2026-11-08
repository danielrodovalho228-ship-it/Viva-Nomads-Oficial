import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync("src/components/property-card.tsx", "utf8");

// C9 (QA, 07/11): a 1280 px, em 3 colunas, o bairro do cartão da busca era cortado com "…" ("Santa Mônica, Uberlândia -…").
// A localização decide o clique: passa a quebrar em até 2 linhas, sem reticências.
test("a localização do cartão quebra em até 2 linhas (line-clamp-2), não é cortada em 1 linha com reticências", () => {
  const linha = cartao.split("\n").find((l) => l.includes('data-testid="cartao-local"')) ?? "";
  assert.match(linha, /line-clamp-2/);
  assert.doesNotMatch(linha, /\btruncate\b/);
});
