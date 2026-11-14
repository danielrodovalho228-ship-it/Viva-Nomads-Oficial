import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync("src/components/property-card.tsx", "utf8");

// C9 (QA, 07/11): a 1280 px, em 3 colunas, o bairro do cartão da busca era cortado com "…" ("Santa Mônica, Uberlândia -…").
// A localização decide o clique: passa a quebrar em até 2 linhas, sem reticências.
// E899 (asserção alterada, decisão do Daniel de 13/11: cartão enxuto, o local em no máximo 1 linha). Antes (C9): até 2 linhas
// (line-clamp-2). Agora: line-clamp-1; o nome completo está a um toque, na página do imóvel.
test("E899: a localização do cartão ocupa no máximo 1 linha (line-clamp-1)", () => {
  const linha = cartao.split("\n").find((l) => l.includes('data-testid="cartao-local"')) ?? "";
  assert.match(linha, /line-clamp-1/);
  assert.doesNotMatch(linha, /line-clamp-2/);
});
