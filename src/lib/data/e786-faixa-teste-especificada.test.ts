/*
  E786 (julgamento de 11/11: PARCIAL / reprova de conformidade):
   • a faixa dizia "Anúncio de teste: fora da busca e das listagens" (pílula cinza) para a equipe — fora do especificado;
   • o VN-4A693A ("TESTE QA - Casa mobiliada…", sem colchetes, de CONTA DE TESTE) não mostrava faixa nenhuma.
  Agora: anúncio de teste = marca no título OU dono conta de teste (a regra do E131); a faixa é UMA só, com o texto
  especificado, igual para todos, quebrando linha (sem estouro horizontal). O "Solicitar" segue a regra do E93.
  Roda: node --test src/lib/data/e786-faixa-teste-especificada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXA_TESTE, modoAnuncioTeste } from "./anuncio-teste.ts";

test("o texto da faixa é o especificado", () => {
  assert.equal(FAIXA_TESTE, "Anúncio de teste da equipe Viva — não é um imóvel disponível");
});

test("anúncio de CONTA DE TESTE sem a marca no título também é anúncio de teste (VN-4A693A)", () => {
  const titulo = "TESTE QA - Casa mobiliada 2 quartos no Centro";
  assert.equal(modoAnuncioTeste(titulo, { dono: false, admin: false }), null, "sem saber do dono, o título sozinho não basta");
  assert.equal(modoAnuncioTeste(titulo, { dono: false, admin: false }, true), "visitante");
  assert.equal(modoAnuncioTeste(titulo, { dono: true, admin: false }, true), "equipe");
  assert.equal(modoAnuncioTeste("Studio de verdade", { dono: false, admin: false }, false), null);
});

test("a página mostra UMA faixa, com o mesmo texto e o mesmo desenho para equipe e visitante, e recebe o dono-teste do servidor", () => {
  const det = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  const faixa = det.slice(det.indexOf('data-testid="faixa-anuncio-teste"') - 200, det.indexOf('data-testid="faixa-anuncio-teste"') + 600);
  assert.match(faixa, /\{FAIXA_TESTE\}/);
  assert.doesNotMatch(faixa, /FAIXA_TESTE_EQUIPE|modoTeste === "visitante"\s*\?/);
  assert.match(faixa, /break-words/);
  assert.match(det, /modoAnuncioTeste\(property\.title, \{[^}]*\}, donoTeste\)/);
  const pagina = readFileSync("src/app/(public)/imoveis/[id]/page.tsx", "utf8");
  assert.match(pagina, /donoTeste=\{donoTeste\}/);
});
