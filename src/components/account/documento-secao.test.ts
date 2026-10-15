/*
  F26 (ordem c53c86f0): a seção "Documento (CPF)" nunca some da tela.
  Roda: node --test src/components/account/documento-secao.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conta-secoes.tsx", import.meta.url), "utf8");
const bloco = src.slice(src.indexOf("export function DocumentoPessoa"), src.indexOf("export function PerfilDoModo"));

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
