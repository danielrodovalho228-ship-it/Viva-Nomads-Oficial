/**
 * E578 (chat principal, 04/11): o bloco "Para proprietários" da home citava só "menor a taxa (até 6%)", sem o Plano Gestor
 * (E564: 12/10/8/6% e Gestor 4% a partir de 20 imóveis ou administradora). Muda SÓ essa menção; o Gestor sai das
 * constantes (GESTOR_PRECO), sem número escrito à mão. `npm test`.
 *
 * Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor saiu da home. O parágrafo volta a "menor a taxa (até 6%).
 * Sem mensalidade." e ganha a linha das carteiras; os números (12% e 6%) e a linha vêm das constantes da regra (TAXA_MAIOR_TEXTO,
 * TAXA_MENOR_TEXTO, TEXTO_CARTEIRAS) — segue sem número escrito à mão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TAXA_MAIOR_TEXTO, TAXA_MENOR_TEXTO } from "./cobranca/regra.ts";
import { TEXTO_CARTEIRAS } from "../config/planos.ts";

const home = readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");

test("078: a home não cita mais o Plano Gestor; a faixa da taxa e a linha das carteiras vêm das constantes", () => {
  // 078 (Daniel, 16/11/2026): antes "menor a taxa (até 6%; Plano Gestor: {GESTOR_PCT_HOME}% a partir de {GESTOR_PRECO.minimoImoveis}
  // imóveis ou para administradoras). Sem mensalidade." — a menção ao Gestor saiu; a menor taxa vem de TAXA_MENOR_TEXTO e, depois de
  // "Sem mensalidade.", entra a linha das carteiras.
  assert.match(
    home,
    /Quanto mais imóveis, menor a taxa \(até \{TAXA_MENOR_TEXTO\}\)\. Sem\s+mensalidade\. \{TEXTO_CARTEIRAS\}\s*<\/p>/,
  );
  assert.doesNotMatch(home, /Plano Gestor|para administradoras\)/);
  // 078 (Daniel, 16/11/2026): antes /const GESTOR_PCT_HOME = String(Math.round(GESTOR_PRECO.taxa * 1000) / 10)…/ — a conta própria da
  // home saiu; as constantes são importadas da regra e de config/planos, e valem 6% e a linha única.
  assert.doesNotMatch(home, /GESTOR_PCT_HOME|GESTOR_PRECO/);
  assert.match(home, /import \{ TAXA_MAIOR_TEXTO, TAXA_MENOR_TEXTO \} from "@\/lib\/cobranca\/regra";/);
  assert.match(home, /import \{ TEXTO_CARTEIRAS \} from "@\/config\/planos";/);
  assert.equal(TAXA_MENOR_TEXTO, "6%");
  assert.equal(TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
});

test("o resto do parágrafo não muda", () => {
  // 078 (Daniel, 16/11/2026): antes o "12%" era digitado ("A Viva cobra 12% sobre…"); a frase é a mesma, com o número vindo da regra.
  assert.match(home, /anuncia de graça\. A Viva cobra \{TAXA_MAIOR_TEXTO\} sobre o valor total do contrato fechado\. Quanto mais imóveis/);
  assert.equal(TAXA_MAIOR_TEXTO, "12%");
  // 078 (Daniel, 16/11/2026): antes doesNotMatch /menor a taxa \(até 6%\)\. Sem/ (a frase sem o Gestor era o erro do E578). Agora a
  // frase SEM o Gestor é a certa; o que não pode é percentual da taxa digitado à mão nesse parágrafo.
  assert.doesNotMatch(home, /A Viva cobra \d+ ?%|menor a taxa \(até \d+ ?%/);
});
