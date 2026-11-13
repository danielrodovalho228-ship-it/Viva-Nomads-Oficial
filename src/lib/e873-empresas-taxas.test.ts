/*
  E873 — /empresas não mostrava NENHUMA taxa. Agora mostra a estrutura aprovada, da fonte única.
  Roda: node --test src/lib/e873-empresas-taxas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRASE_TAXA_EMPRESAS, linhasTaxaEmpresas } from "./empresas-taxas.ts";

const pagina = readFileSync(new URL("../app/(public)/empresas/page.tsx", import.meta.url), "utf8");

test("as cinco faixas aprovadas: 12% · 10% · 8% · 6% e Plano Gestor 4% a partir de 20 imóveis", () => {
  assert.deepEqual(linhasTaxaEmpresas(), [
    { faixa: "1–2 imóveis", taxa: "12%", gestor: false },
    { faixa: "3–5 imóveis", taxa: "10%", gestor: false },
    { faixa: "6–15 imóveis", taxa: "8%", gestor: false },
    { faixa: "16–19 imóveis", taxa: "6%", gestor: false },
    { faixa: "20+ imóveis · Plano Gestor", taxa: "4%", gestor: true },
  ]);
});

test("a frase diz quem paga (o proprietário), sobre o quê, a faixa e o Gestor — e que o morador não paga", () => {
  assert.match(FRASE_TAXA_EMPRESAS, /paga pelo proprietário, sobre o valor total do contrato fechado: de 12% a 6%/);
  assert.match(FRASE_TAXA_EMPRESAS, /4% no Plano Gestor \(carteiras de 20 ou mais imóveis\)/);
  assert.match(FRASE_TAXA_EMPRESAS, /Quem vem morar não paga taxa à plataforma/);
});

test("a página /empresas desenha a tabela e a frase (fonte única, nada digitado à mão) e o FAQ cita a taxa", () => {
  assert.match(pagina, /data-testid="empresas-taxas"/);
  assert.match(pagina, /linhasTaxaEmpresas\(\)\.map/);
  assert.match(pagina, /\{FRASE_TAXA_EMPRESAS\}/);
  assert.match(pagina, /Qual é o prazo de resposta e a taxa\?", r: `A equipe responde em até 7 dias[^`]*\$\{FRASE_TAXA_EMPRESAS\}`/);
  assert.doesNotMatch(pagina, /\b(12|10|8|6|4)%/, "nenhum percentual digitado à mão");
});
