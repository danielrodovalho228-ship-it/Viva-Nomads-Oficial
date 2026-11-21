import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/property/destaques-imovel.tsx", "utf8");

// Varredura 08/11 (1280 px, /imoveis/ube-006…015): a linha de detalhe do cartão "Pronto para morar" dos Destaques
// ("Imóvel mobiliado e equipado") era cortada com "…". Quebra em até 2 linhas, sem reticências.
test("a linha de detalhe dos Destaques quebra em até 2 linhas, sem reticências", () => {
  const linha = fonte.split("\n").find((l) => l.includes("{d.detalhe}")) ?? "";
  assert.match(linha, /line-clamp-2/);
  assert.doesNotMatch(linha, /\btruncate\b/);
});
