/* Roda: node --test src/components/property/e357-comodidades-agrupadas.test.ts
  E357: a lista de comodidades do anúncio ("Tem") é agrupada por categoria (ícone por item, grade par) — não uma lista plana. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/components/property/amenities-grid.tsx", "utf8");

test("E357: com 'Tem' × 'Não tem', o 'Tem' renderiza um grupo por categoria", () => {
  assert.match(src, /comTemNaoTem \? \(\s*[\s\S]{0,200}data-testid="comodidades-principais">\s*\{blocos\.imovel\.map\(\(g\) => \(\s*<GrupoDeComodidades key=\{g\.category\} grupo=\{g\} \/>/);
});

test("E357: o grupo tem título com o ícone da categoria e itens com ícone em grade de 2 colunas; a folha usa o mesmo componente", () => {
  const g = src.slice(src.indexOf("function GrupoDeComodidades"), src.indexOf("export function AmenitiesGrid"));
  assert.match(g, /data-testid="comodidades-categoria"/);
  assert.match(g, /grid grid-cols-2 gap-x-4 gap-y-3/);
  assert.match(g, /<ItemComodidade key=\{item\} item=\{item\} \/>/);
  const folha = src.slice(src.indexOf('data-testid="comodidades-lista-completa"'));
  assert.match(folha, /<GrupoDeComodidades key=\{g\.category\} grupo=\{g\} \/>/);
});

test("E357: sem 'Não tem' continua a grade única das principais (e o botão 'Ver todas' abre a lista agrupada)", () => {
  assert.match(src, /<ul className="grid grid-cols-2 gap-x-4 gap-y-3" data-testid="comodidades-principais">/);
  assert.match(src, /comodidades-ver-todas/);
});
