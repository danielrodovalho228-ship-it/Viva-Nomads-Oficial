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
