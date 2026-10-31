/*
  Erro fora do alcance do error.tsx do painel: o layout do painel ((dashboard)/layout.tsx) e o layout raiz não são
  cobertos pelo error.tsx do próprio segmento. Sem src/app/error.tsx e src/app/global-error.tsx, a falha caía na
  página padrão do Next, em inglês. Aqui: os dois existem, em português, com "Tentar de novo" pelas props do Next 16.
  Roda: node --test src/lib/painel/erro-raiz.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");

test("app/error.tsx: em português, 'Tentar de novo' por unstable_retry (reset de reserva), início e ajuda", () => {
  assert.ok(existsSync(new URL("src/app/error.tsx", RAIZ)));
  const t = ler("src/app/error.tsx");
  assert.match(t, /^"use client";/);
  assert.match(t, /Não conseguimos abrir esta página/);
  assert.match(t, /\{ unstable_retry, reset \}/);
  assert.match(t, /const tentarDeNovo = \(\) => \(unstable_retry \?\? reset\)\?\.\(\);/);
  assert.match(t, /href="\/"/);
  assert.match(t, /href="\/ajuda"/);
});

test("app/global-error.tsx: html e body próprios em pt-BR, estilo inline, 'Tentar de novo'", () => {
  assert.ok(existsSync(new URL("src/app/global-error.tsx", RAIZ)));
  const t = ler("src/app/global-error.tsx");
  assert.match(t, /^"use client";/);
  assert.match(t, /<html lang="pt-BR">/);
  assert.match(t, /<body style=/);
  assert.match(t, /\{ unstable_retry, reset \}/);
  assert.match(t, /Tentar de novo/);
  assert.doesNotMatch(t, /Something went wrong|Try again|Application error/);
});

test("o layout do painel lê dados (pode falhar) e não é coberto pelo error.tsx do próprio segmento", () => {
  // O error.tsx de /dashboard cobre as páginas; a falha do layout de (dashboard) sobe até src/app/error.tsx.
  assert.match(ler("src/app/(dashboard)/layout.tsx"), /await Promise\.all\(\[resolveInitialMode\(\), contadoresIniciaisDoPainel\(\)\]\)/);
  assert.ok(!existsSync(new URL("src/app/(dashboard)/error.tsx", RAIZ)));
});
