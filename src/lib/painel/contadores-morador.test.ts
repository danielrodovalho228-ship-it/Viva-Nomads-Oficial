/*
  E181 — contadores do Início do morador leem das mesmas fontes das listas.
  Roda: node --test src/lib/painel/contadores-morador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { totalFavoritos } from "./contadores-morador.ts";

const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

test("Favoritos: conta o que a lista mostra; enquanto carrega, os ids guardados", () => {
  assert.equal(totalFavoritos({ ids: ["a", "b"], favoritos: [], loading: true }), 2);
  assert.equal(totalFavoritos({ ids: ["a", "b"], favoritos: [{}], loading: false }), 1);
  assert.equal(totalFavoritos({ ids: [], favoritos: [], loading: false }), 0);
});

test("Início do morador: nenhum contador fixo; Favoritos e Buscas salvas vêm das fontes das listas", () => {
  const cliente = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  // Nada de "0" escrito à mão nos cartões do morador.
  assert.doesNotMatch(cliente, /label="Favoritos" value=\{demo \? "3" : "0"\}/);
  assert.doesNotMatch(cliente, /label="Buscas salvas" value=\{demo \? "2" : "0"\}/);
  // Favoritos: o mesmo hook da página /dashboard/favoritos.
  assert.match(cliente, /useFavoritos\(\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/favoritos/page.tsx"), /useFavoritos\(\)/);
  assert.match(cliente, /String\(totalFavoritos\(/);
  assert.match(cliente, /String\(totalBuscasSalvas\)/);
  // Buscas salvas: a mesma consulta de /dashboard/buscas.
  const pagina = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /listarBuscasSalvas\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalBuscasSalvas=\{buscasSalvas\.length\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/buscas/page.tsx"), /await listarBuscasSalvas\(\)/);
});
