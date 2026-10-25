/* Roda: node --test src/lib/parceiros/rotas-categoria.test.ts — E187 (rotas de categoria de parceiros sem 404). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoDaCategoria } from "./rotas-categoria.ts";

test("categorias do catálogo vão à busca filtrada; plurais e apelidos também", () => {
  assert.equal(destinoDaCategoria("limpeza"), "/parceiros/buscar?categoria=limpeza");
  assert.equal(destinoDaCategoria("montagem"), "/parceiros/buscar?categoria=montagem");
  assert.equal(destinoDaCategoria("mudancas"), "/parceiros/buscar?categoria=mudanca");
  assert.equal(destinoDaCategoria("Manutencao"), "/parceiros/buscar?categoria=manutencao");
  assert.equal(destinoDaCategoria("montagem-de-moveis"), "/parceiros/buscar?categoria=montagem");
});

test("seguros e gestores vão aos tipos de parceria; fotografia à página dos fotógrafos", () => {
  assert.equal(destinoDaCategoria("seguros"), "/parceiros#tipos");
  assert.equal(destinoDaCategoria("gestores"), "/parceiros#tipos");
  assert.equal(destinoDaCategoria("fotografia"), "/parceiros/fotografos");
});

test("o avaliador (só credenciamento) e endereços desconhecidos seguem no 404", () => {
  assert.equal(destinoDaCategoria("vistoria"), null);
  assert.equal(destinoDaCategoria("paulo-fotos-teste-qa"), null);
});

test("a página do parceiro tem prioridade: o desvio só acontece sem parceiro com esse endereço", () => {
  const tela = readFileSync("src/app/(public)/parceiros/[slug]/page.tsx", "utf8");
  assert.match(tela, /if \(!d\) \{[\s\S]*?destinoDaCategoria\(slug\)[\s\S]*?redirect\(destino\)[\s\S]*?notFound\(\);/);
});
