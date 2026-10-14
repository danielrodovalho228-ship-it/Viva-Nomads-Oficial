/*
  Anúncios de teste do QA ("[TESTE QA] ...") nunca aparecem nas listagens públicas
  (home, busca, cidades, 404, sitemap — todas passam por listProperties).
  Roda: node --test src/lib/data/anuncio-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehAnuncioDeTeste, semAnunciosDeTeste } from "./anuncio-teste.ts";

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
