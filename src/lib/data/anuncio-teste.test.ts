/*
  Anúncios de teste do QA ("[TESTE QA] ...") nunca aparecem nas listagens públicas
  (home, busca, cidades, 404, sitemap — todas passam por listProperties).
  Roda: node --test src/lib/data/anuncio-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXA_TESTE_EQUIPE, FAIXA_TESTE_VISITANTE, ehAnuncioDeTeste, modoAnuncioTeste, semAnunciosDeTeste } from "./anuncio-teste.ts";

test("reconhece a marca de teste no começo do título", () => {
  for (const t of ["[TESTE QA] Studio Pinheiros", "[teste] Loft", "  [Teste QA 2] Casa", "[TEST] Flat", "[QA] Casa"]) {
    assert.equal(ehAnuncioDeTeste(t), true, t);
  }
});

test("título normal ou com a palavra no meio não é teste (caso negativo)", () => {
  for (const t of ["Studio mobiliado em Pinheiros", "Loft perto do teste de pista", "Casa [reformada]", "", null, undefined]) {
    assert.equal(ehAnuncioDeTeste(t), false, String(t));
  }
});

test("semAnunciosDeTeste tira só os de teste e mantém a ordem", () => {
  const lista = [{ title: "A" }, { title: "[TESTE QA] B" }, { title: "C" }];
  assert.deepEqual(semAnunciosDeTeste(lista).map((p) => p.title), ["A", "C"]);
});

test("listProperties usa o filtro", () => {
  const src = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
  assert.match(src, /semAnunciosDeTeste\(\(data as unknown as PropertyRow\[\]\)\.map\(rowToProperty\)\.map\(comCoordenadaAproximada\)\)/);
});

test("E93: anúncio de teste pelo link — faixa e 'Solicitar' desativado para quem não é dono nem admin", () => {
  assert.equal(FAIXA_TESTE_VISITANTE, "Anúncio de teste da equipe Viva — não é um imóvel disponível");
  assert.equal(FAIXA_TESTE_EQUIPE, "Anúncio de teste: fora da busca e das listagens");
  assert.equal(modoAnuncioTeste("[TESTE] Studio", { dono: false, admin: false }), "visitante");
  assert.equal(modoAnuncioTeste("[TESTE] Studio", { dono: true, admin: false }), "equipe");
  assert.equal(modoAnuncioTeste("[QA] Studio", { dono: false, admin: true }), "equipe");
  assert.equal(modoAnuncioTeste("Studio de verdade", { dono: false, admin: false }), null);
  const tela = readFileSync(new URL("../../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(tela, /disabled=\{pending !== null \|\| testeVisitante\}/);
  assert.match(tela, /bloqueio=\{testeVisitante \? FAIXA_TESTE_VISITANTE : undefined\}/);
  assert.match(tela, /if \(testeVisitante\) return;/);
  // Segue fora das listagens e com noindex na página direta.
  assert.match(readFileSync(new URL("../../app/(public)/imoveis/[id]/page.tsx", import.meta.url), "utf8"), /ehAnuncioDeTeste\(property\.title\) \? \{ robots: \{ index: false, follow: true \} \}/);
});
