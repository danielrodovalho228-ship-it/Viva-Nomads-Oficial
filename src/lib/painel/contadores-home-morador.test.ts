/* Roda: node --test src/lib/painel/contadores-home-morador.test.ts — E181: os contadores da home do morador = as listas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Favoritos e Buscas salvas contam as MESMAS listas das telas de destino (nunca um número fixo)", () => {
  const home = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.doesNotMatch(home, /label="Favoritos" value=\{demo \? "3" : "0"\}/);
  assert.doesNotMatch(home, /label="Buscas salvas" value=\{demo \? "2" : "0"\}/);
  // Favoritos: a lista de /dashboard/favoritos (useFavoritos — os favoritados que existem).
  assert.match(home, /const \{ favoritos \} = useFavoritos\(\);/);
  assert.match(home, /label="Favoritos" value=\{demo \? "3" : String\(favoritos\.length\)\}/);
  assert.match(ler("app/(dashboard)/dashboard/favoritos/page.tsx"), /useFavoritos\(\)/);
  // Buscas salvas: a lista de /dashboard/buscas (listarBuscasSalvas), lida no servidor.
  assert.match(home, /label="Buscas salvas" value=\{demo \? "2" : String\(totalBuscasSalvas\)\}/);
  const pagina = ler("app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /listarBuscasSalvas\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pagina, /totalBuscasSalvas=\{buscasSalvas\.length\}/);
  assert.match(ler("app/(dashboard)/dashboard/buscas/page.tsx"), /listarBuscasSalvas/);
});
