/* Roda: node --test src/lib/parceiros/apresentacao.test.ts — bloco parceiro do Muse (31/10): E296, E298, E299, E300, E306. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELO_APROVADO, capaDoParceiro, iniciaisDoParceiro } from "./apresentacao.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const DETALHE = ler("src/app/(public)/parceiros/[slug]/page.tsx");
const CARTAO = ler("src/components/parceiros/cartao-parceiro.tsx");

test("E300: iniciais certas — nunca o '[' de um prefixo, nunca vazio", () => {
  assert.equal(iniciaisDoParceiro("[TESTE QA] Limpeza E213"), "LE");
  assert.equal(iniciaisDoParceiro("Paulo Fotos Teste QA"), "PF");
  assert.equal(iniciaisDoParceiro("ana"), "A");
  assert.equal(iniciaisDoParceiro("Élida Souza"), "ÉS");
  assert.equal(iniciaisDoParceiro("[QA]"), "Q");
  assert.equal(iniciaisDoParceiro("123"), "?");
  assert.doesNotMatch(CARTAO + DETALHE, /nomePublico\.slice\(0, 1\)/);
  assert.match(CARTAO, /\{iniciaisDoParceiro\(p\.nomePublico\)\}/);
  assert.match(DETALHE, /\{iniciaisDoParceiro\(p\.nomePublico\)\}/);
});

test("E298/E306: a capa nunca é vazia — capa enviada → 1ª foto da galeria → foto do parceiro → foto da categoria", () => {
  const base = { nomePublico: "X", bannerUrl: null, avatarUrl: null, categorias: ["limpeza"] };
  assert.equal(capaDoParceiro({ ...base, bannerUrl: "https://b/capa.webp", galeriaCapaUrl: "https://b/g.webp", avatarUrl: "https://b/a.webp" })?.origem, "capa");
  // E306 (01/11): sem capa enviada, a foto DO PRÓPRIO parceiro — a 1ª da galeria — antes da foto genérica da categoria.
  const gal = capaDoParceiro({ ...base, galeriaCapaUrl: "https://b/g.webp", avatarUrl: "https://b/a.webp" })!;
  assert.equal(gal.origem, "galeria");
  assert.equal(gal.src, "https://b/g.webp");
  assert.equal(capaDoParceiro({ ...base, avatarUrl: "https://b/a.webp" })?.origem, "foto");
  const cat = capaDoParceiro(base)!;
  assert.equal(cat.origem, "categoria");
  assert.match(cat.src, /^\/images\//);
  assert.equal(capaDoParceiro({ ...base, categorias: ["nao-existe", "mudanca"] })?.origem, "categoria");
  assert.match(DETALHE, /const capa = capaDoParceiro\(\{ \.\.\.p, galeriaCapaUrl: galeria\[0\]\?\.url \?\? null \}\);/);
  assert.match(CARTAO, /const capa = capaDoParceiro\(p\);/);
});

test("E296: no detalhe, o bloco do nome fica acima da capa e o nome começa abaixo dela", () => {
  assert.match(DETALHE, /className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-start" data-testid="parceiro-cabecalho"/);
  assert.match(DETALHE, /<div className="min-w-0 flex-1 sm:pt-16">\s*<h1/);
});

test("E299: selo 'Aprovado pela Viva' no cartão e no detalhe; Sobre e Galeria sempre no detalhe", () => {
  assert.equal(SELO_APROVADO, "Aprovado pela Viva");
  for (const f of [CARTAO, DETALHE]) assert.match(f, /data-testid="selo-aprovado"[\s\S]{0,120}\{SELO_APROVADO\}/);
  assert.match(DETALHE, /data-testid="parceiro-sobre"/);
  assert.match(DETALHE, /ainda não escreveu sobre o trabalho/);
  assert.match(DETALHE, /data-testid="parceiro-galeria-secao"/);
  assert.match(DETALHE, /Ainda sem fotos de trabalhos\./);
  assert.doesNotMatch(DETALHE, /\{p\.descricao && \(\s*<section aria-labelledby="h-sobre"/);
});
