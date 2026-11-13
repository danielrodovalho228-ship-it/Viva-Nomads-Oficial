/*
  E881 — /parceiros/fotografos abria só com o formulário: sem lista e sem o "ainda não temos" da busca genérica.
  Roda: node --test src/lib/fotografos/e881-lista-inicial.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_SEM_FOTOGRAFO_NENHUM, estadoPaginaFotografos } from "./aviso.ts";

const pagina = readFileSync("src/app/(public)/parceiros/fotografos/page.tsx", "utf8");

test("ao abrir sem cidade: lista quando há fotógrafo publicado, estado zero quando não há", () => {
  assert.equal(estadoPaginaFotografos({ buscou: false, cidade: "", total: 3 }), "lista");
  assert.equal(estadoPaginaFotografos({ buscou: false, cidade: "", total: 0 }), "vazio");
  assert.equal(estadoPaginaFotografos({ buscou: true, cidade: "Uberlândia", total: 0 }), "cidade");
  assert.equal(estadoPaginaFotografos({ buscou: true, cidade: "", total: 5 }), "cep", "CEP não encontrado segue com o aviso do CEP");
  assert.match(TEXTO_SEM_FOTOGRAFO_NENHUM, /^Ainda não temos fotógrafo parceiro publicado\./);
});

test("a página desenha a lista inicial (todos os publicados) e o estado zero, da mesma busca", () => {
  assert.match(pagina, /const estado = estadoPaginaFotografos\(\{ buscou, cidade, total: r\.lista\.length \}\);/);
  assert.match(pagina, /\{estado === "lista" && \([\s\S]*?data-testid="fotografos-todos"[\s\S]*?r\.lista\.map\(\(p\) => \(\s*<CartaoParceiro/);
  assert.match(pagina, /\{estado === "vazio" && \([\s\S]*?data-testid="fotografos-nenhum"[\s\S]*?\{TEXTO_SEM_FOTOGRAFO_NENHUM\}/);
  // A busca é a mesma (categoria fotografia); sem cidade ela devolve todos os publicados.
  assert.match(pagina, /buscarParceiros\(\{ categoria: "fotografia", cidade: sp\.cidade, uf: sp\.uf, cep: cepBusca \}\)/);
});
