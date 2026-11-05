/**
 * E578 (chat principal, 04/11): o bloco "Para proprietários" da home citava só "menor a taxa (até 6%)", sem o Plano Gestor
 * (E564: 12/10/8/6% e Gestor 4% a partir de 20 imóveis ou administradora). Muda SÓ essa menção; o Gestor sai das
 * constantes (GESTOR_PRECO), sem número escrito à mão. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");

test("a home cita o Plano Gestor na faixa da taxa, pelas constantes", () => {
  assert.match(
    home,
    /Quanto mais imóveis, menor a taxa \(até 6%; Plano Gestor: \{GESTOR_PCT_HOME\}% a partir de \{GESTOR_PRECO\.minimoImoveis\} imóveis ou para administradoras\)\. Sem\s+mensalidade\./,
  );
  assert.match(home, /const GESTOR_PCT_HOME = String\(Math\.round\(GESTOR_PRECO\.taxa \* 1000\) \/ 10\)\.replace\("\.", ","\);/);
});

test("o resto do parágrafo não muda", () => {
  assert.match(home, /anuncia de graça\. A Viva cobra 12% sobre o valor total do contrato fechado\. Quanto mais imóveis/);
  assert.doesNotMatch(home, /menor a taxa \(até 6%\)\. Sem/);
});
