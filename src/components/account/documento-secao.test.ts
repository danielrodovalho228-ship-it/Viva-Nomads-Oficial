/*
  F26 (ordem c53c86f0): a seção "Documento (CPF)" nunca some da tela.
  Roda: node --test src/components/account/documento-secao.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conta-secoes.tsx", import.meta.url), "utf8");
const bloco = src.slice(src.indexOf("export function DocumentoPessoa"), src.indexOf("export function AjudaContato"));

test("DocumentoPessoa não devolve null (carregando ou sessão não resolvida)", () => {
  assert.doesNotMatch(bloco, /return null/);
});

test("mostra esqueleto enquanto carrega e 'Tentar de novo' quando falha", () => {
  assert.match(bloco, /data-testid="documento-carregando"/);
  assert.match(bloco, /data-testid="documento-erro"/);
  assert.match(bloco, /Tentar de novo/);
});

test("âncora #documento presente em todos os estados", () => {
  const ancoras = bloco.match(/<section id="documento"/g) ?? [];
  assert.equal(ancoras.length, 2);
});

test("falha de rede não vira CPF vazio digitável (não finge que carregou)", () => {
  assert.doesNotMatch(bloco, /DOCUMENTO_VAZIO_PF/);
});

test("link do Documento leva à tela Dados (vale no app e no site) e todo uso passa por LINK_DOCUMENTO", () => {
  const lib = readFileSync(new URL("../../lib/documento-pessoa.ts", import.meta.url), "utf8");
  assert.match(lib, /LINK_DOCUMENTO = "\/dashboard\/conta\/dados#documento"/);
  const fechamento = readFileSync(new URL("../../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(fechamento, /href="\/dashboard\/conta#documento"/);
  assert.match(fechamento, /href=\{LINK_DOCUMENTO\}/);
});
