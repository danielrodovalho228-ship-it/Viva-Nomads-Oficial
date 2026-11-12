/* Roda: node --test src/components/property/e786-selo-teste-sem-transbordo.test.ts — E786: o selo "Anúncio de teste da equipe Viva…" quebra linha em vez de estourar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("botão do cartão (computador) do anúncio de teste quebra linha e cresce", () => {
  const s = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(s, /testeVisitante \? "hidden h-auto min-h-12 w-full whitespace-normal[^"]*lg:inline-flex"/);
});
test("botão da barra fixa (celular) com bloqueio quebra linha", () => {
  const s = readFileSync("src/components/property/barra-fixa-celular.tsx", "utf8");
  assert.match(s, /bloqueio \? "h-auto min-h-11 flex-1 whitespace-normal/);
});

test("varredura: as faixas de teste só aparecem em <p> (quebra natural) ou nos dois botões corrigidos", () => {
  const imovel = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(imovel, /<p\s+role="note"\s+data-testid="faixa-anuncio-teste"/);
  const parceiro = readFileSync("src/app/(public)/parceiros/[slug]/page.tsx", "utf8");
  assert.match(parceiro, /<p\s+role="status"\s+data-testid="faixa-parceiro-teste"/);
  // Nenhum outro botão leva a faixa como rótulo.
  const usos = imovel.split("\n").filter((l) => /FAIXA_TESTE_VISITANTE/.test(l) && !/^import/.test(l.trim()));
  assert.equal(usos.length, 3); // botão do cartão, faixa <p>, bloqueio da barra fixa
});
test("1920 px: o botão do cartão não tem largura fixa nem nowrap no modo teste", () => {
  const s = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  const linha = s.split("\n").find((l) => l.includes("whitespace-normal") && l.includes("lg:inline-flex")) ?? "";
  assert.ok(linha && !/whitespace-nowrap|\bw-\[|\bmin-w-/.test(linha));
});
