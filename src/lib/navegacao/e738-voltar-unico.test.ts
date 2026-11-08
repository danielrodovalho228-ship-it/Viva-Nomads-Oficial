// E738 (lista-master 08/11): /dashboard/imoveis/[id]/nivel mostrava DOIS "Voltar" empilhados — o "← Voltar" do cabeçalho padrão do
// painel (E720) e um "← Meus imóveis" da própria tela. O mesmo valia para as outras telas do imóvel (parceiros, desempenho, cartão e
// conforto). Fica UM só: o do cabeçalho padrão. As telas não repetem o seu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { painelMostraVoltar } from "./voltar-painel.ts";

const TELAS = ["parceiros", "desempenho", "nivel", "cartao", "conforto"];

test("E738: o painel mostra o voltar padrão nas telas do imóvel", () => {
  for (const t of TELAS) assert.equal(painelMostraVoltar(`/dashboard/imoveis/abc/${t}`), true, t);
});

test("E738: as telas do imóvel não trazem um segundo '← Meus imóveis'", () => {
  for (const t of TELAS) {
    const s = readFileSync(`src/app/(dashboard)/dashboard/imoveis/[id]/${t}/page.tsx`, "utf8");
    assert.doesNotMatch(s, /<ArrowLeft/, t);
    assert.doesNotMatch(s, /Meus imóveis\s*\n?\s*<\/Link>/, t);
  }
});
