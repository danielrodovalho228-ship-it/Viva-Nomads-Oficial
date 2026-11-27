import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/*
  E501: no "Continue seu anúncio", a metade esquerda aparecia como painel cinza vazio com ícone de imagem quebrada.
  - foto que não carrega no navegador (arquivo ilegível, URL que expirou) cai no espaço desenhado — nunca caixa cinza;
  - o espaço desenhado do rascunho sem foto tem moldura tracejada e ícone de câmera (não o ícone de "imagem");
  - nas outras variações (sem espaço desenhado), foto que falha some e a grade volta a uma coluna.
*/
test("E501: a foto do bloco principal tem plano B quando não carrega", () => {
  const c = ler("components/painel/foto-inicio-dono.tsx");
  assert.match(c, /^"use client";/);
  assert.match(c, /onError=\{\(\) => setFalhou\(true\)\}/);
  // imagem que falhou antes da hidratação também conta
  assert.match(c, /complete && .*naturalWidth === 0/);
  assert.match(c, /data-testid="inicio-dono-foto"/);
  assert.match(c, /data-testid="inicio-dono-foto-vazia"/);
});

test("E501: o espaço desenhado não parece imagem quebrada (moldura tracejada, câmera, mesmo texto aprovado)", () => {
  const c = ler("components/painel/foto-inicio-dono.tsx");
  assert.match(c, /border-dashed/);
  assert.match(c, /<Camera /);
  assert.doesNotMatch(c, /ImageIcon/);
  assert.match(c, /A foto principal aparece aqui/);
});

test("E501: o início do dono usa o componente e recolhe a grade quando a foto some", () => {
  const c = ler("components/painel/inicio-dono.tsx");
  assert.match(c, /<FotoDoInicio foto=\{foto\} rascunho=\{bloco\.tipo === "rascunho"\} \/>/);
  assert.match(c, /lg:has-\[\[data-foto-falhou\]\]:grid-cols-1/);
  assert.doesNotMatch(c, /ImageIcon/);
});
