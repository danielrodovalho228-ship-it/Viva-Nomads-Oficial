/* Roda: node --test src/components/e374-fotos-destaque.test.ts
  E374 (a): "fotos de destaque da página 404 em branco em algumas cargas". As fotos dos destaques da 404 (e dos recomendados e favoritos do painel),
  que já estão à vista, carregam com prioridade como as da busca (E454); "Imóveis parecidos" (abaixo da dobra) segue preguiçoso. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E374: destaques da 404, recomendados do painel e favoritos do painel marcam a primeira fileira como prioridade", () => {
  assert.match(ler("src/app/not-found.tsx"), /prioridade=\{i < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx"), /prioridade=\{i < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/favoritos/page.tsx"), /prioridade=\{i < PRIMEIRA_FILEIRA\}/);
});

test("E374: 'Imóveis parecidos' (abaixo da dobra) não ganha prioridade", () => {
  assert.doesNotMatch(ler("src/components/property/imoveis-parecidos.tsx"), /prioridade=/);
});
