/*
  E606: o Passo 5 tinha dois modelos de gravar — Ruído e Extras exigiam o botão "Salvar" deles, enquanto a estrutura de
  acessibilidade e as comodidades salvavam sozinhas; quem marcava itens e fechava o bloco sem apertar perdia tudo.
  Agora é um modelo só: cada toque salva na hora, com a mesma linha de status em todos os blocos.
  Roda: node --test src/lib/anuncio/e606-passo5-salva-na-hora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const re = readFileSync("src/components/niveis/ruido-extras.tsx", "utf8");
const estrutura = readFileSync("src/components/anuncio/estrutura-acessibilidade.tsx", "utf8");

test("E606: Ruído e Extras não têm mais botão de salvar — o toque grava", () => {
  assert.doesNotMatch(re, /data-testid="ruido-salvar"|data-testid="extras-salvar"|testid="ruido-salvar"|testid="extras-salvar"/);
  assert.doesNotMatch(re, /Salvar ruído|Salvar extras/);
  assert.match(re, /onClick=\{\(\) => void gravar\(\{ \.\.\.r, \[p\.chave\]: !r\[p\.chave\] \}\)\}/);
  assert.match(re, /onClick=\{\(\) => void alternar\(e\.chave\)\}/);
});

test("E606: a mesma frase de gravar nos três blocos do Passo 5", () => {
  const frase = /"Cada toque salva na hora\."/;
  assert.match(estrutura, frase);
  assert.match(re, new RegExp(`COMO_SALVA_RUIDO = ${frase.source}`));
  assert.match(re, new RegExp(`COMO_SALVA_EXTRAS = ${frase.source}`));
});

test("E606: o ruído tem como responder 'não' nas quatro sem botão de salvar", () => {
  assert.match(re, /testid="ruido-nenhum"/);
  assert.match(re, /RUIDO_NENHUM = "Nenhum destes vale para o imóvel"/);
});
