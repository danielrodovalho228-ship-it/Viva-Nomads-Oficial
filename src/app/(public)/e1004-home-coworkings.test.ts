/*
  E1004 (pacote C2-HOME): a home prometia que os coworkings e cafés da região aparecem "no mapa do imóvel".
  A página do imóvel só tem o mapa aproximado (sem esses pontos); os espaços de trabalho da região aparecem em
  listas ("Espaços de trabalho na região", achados pela localização do imóvel, e "Proximidades").
  Roda: node --test "src/app/(public)/e1004-home-coworkings.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const detalhe = readFileSync(new URL("./imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
const trabalho = readFileSync(new URL("../../components/property/workspace-section.tsx", import.meta.url), "utf8");

test("E1004 — a home não promete coworkings 'no mapa do imóvel'; diz que a página do imóvel lista os que ficam por perto", () => {
  assert.doesNotMatch(home, /mapa do imóvel/);
  assert.ok(
    home.includes("A vizinhança costuma ter espaços de trabalho — a página do imóvel lista os que ficam por perto."),
    "o texto novo do bloco 'Coworkings e cafés na região'",
  );
});

test("E1004 — a promessa nova bate com a página do imóvel: lista 'Espaços de trabalho na região' e mapa só aproximado", () => {
  assert.ok(trabalho.includes("Espaços de trabalho na região"));
  assert.ok(detalhe.includes("<WorkspaceSection property={property} />"));
  assert.match(detalhe, /Mapa aproximado/);
});
