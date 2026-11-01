/*
  Tela de erro do site público: uma falha numa página de (public) fica dentro da casca do site (menu, rodapé, barra de
  abas), com "Tentar de novo" e as saídas do site, em vez de subir até o error.tsx da raiz, que troca a página inteira.
  Roda: node --test src/lib/painel/erro-site-publico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const TELA = "src/app/(public)/error.tsx";

test("o site público tem a própria tela de erro: client, unstable_retry (ou reset), início e ajuda", () => {
  assert.ok(existsSync(new URL(TELA, RAIZ)));
  const t = ler(TELA);
  assert.match(t, /^"use client";/);
  assert.match(t, /export default function ErroDoSitePublico\(\{ unstable_retry, reset \}/);
  assert.match(t, /const tentarDeNovo = \(\) => \(unstable_retry \?\? reset\)\?\.\(\);/);
  assert.match(t, /onClick=\{tentarDeNovo\}/);
  assert.match(t, /data-testid="publico-erro"/);
  assert.match(t, /href="\/"/);
  assert.match(t, /href="\/ajuda"/);
  // Nada da casca do painel no site.
  assert.doesNotMatch(t, /href="\/dashboard"|href="\/admin"/);
});

test("fica dentro do <main> do layout do site: a tela de erro não abre outro <main>", () => {
  assert.match(ler("src/app/(public)/layout.tsx"), /<main id="conteudo"/);
  assert.doesNotMatch(ler(TELA).replace(/\/\*[\s\S]*?\*\//g, ""), /<main\b/);
});

test("a raiz continua cobrindo o que este error.tsx não cobre (o próprio layout do site)", () => {
  // error.tsx não cobre o layout do mesmo segmento (docs do Next 16): menu e rodapé seguem no error.tsx da raiz.
  assert.match(ler("src/app/error.tsx"), /data-testid="site-erro"/);
});
