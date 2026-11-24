/*
  E915 — /parceiros/buscar com uma categoria que não existe (ex.: ?categoria=piscina) caía calada em "Todas", e o
  estado vazio armava o "Quero ser avisado" com "parceiro desta categoria" (categoria "outro" por baixo). Correção:
  a página diz que a categoria não existe; o aviso não se arma para ela; sem categoria escolhida, a frase de apoio não
  fala em "desta categoria".
  Roda: node --test src/lib/parceiros/e915-categoria-inexistente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoCategoriaInexistente, categoriaInexistente, textoApoioAviso } from "./regras.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E915: só a categoria fora do catálogo é inexistente; vazio é 'Todas'", () => {
  assert.equal(categoriaInexistente("piscina"), true);
  assert.equal(categoriaInexistente("vistoria"), true, "vistoria é só credenciamento, fora da busca");
  assert.equal(categoriaInexistente("limpeza"), false);
  assert.equal(categoriaInexistente("outro"), false);
  assert.equal(categoriaInexistente(""), false);
  assert.equal(categoriaInexistente(undefined), false);
});

test("E915: o aviso nomeia a categoria pedida (encurtada) e diz que ela não existe", () => {
  assert.match(avisoCategoriaInexistente("piscina"), /A categoria "piscina" não existe/);
  assert.ok(avisoCategoriaInexistente("x".repeat(500)).length < 160, "valor da URL encurtado");
});

test("E915: sem categoria escolhida, a frase de apoio não fala em 'desta categoria'", () => {
  assert.doesNotMatch(textoApoioAviso(true), /categoria/);
  assert.match(textoApoioAviso(false), /desta categoria/);
});

test("E915: a página mostra o aviso da categoria inexistente e passa a marca ao estado vazio", () => {
  const p = ler("../../app/(public)/parceiros/buscar/page.tsx");
  assert.match(p, /const inexistente = categoriaInexistente\(sp\.categoria\)/);
  assert.match(p, /\{inexistente && \([\s\S]*?data-testid="busca-parceiros-categoria-inexistente"[\s\S]*?avisoCategoriaInexistente\(/);
  assert.match(p, /<BuscaVazia[\s\S]*?categoriaInexistente=\{inexistente\}/);
});

test("E915: o 'Quero ser avisado' não se arma para categoria inexistente e sabe quando não há categoria", () => {
  const v = ler("../../components/parceiros/busca-vazia.tsx");
  assert.match(v, /\{!categoriaInexistente && \(\s*<AvisoFotografo/);
  assert.match(v, /semCategoria=\{!categoria\}/);
  const a = ler("../../app/(public)/parceiros/fotografos/aviso-fotografo.tsx");
  assert.doesNotMatch(a, /"Avisamos você quando houver um parceiro desta categoria/, "frase fixa voltou");
  assert.equal((a.match(/textoApoioAviso\(semCategoria\)/g) ?? []).length, 2);
});
