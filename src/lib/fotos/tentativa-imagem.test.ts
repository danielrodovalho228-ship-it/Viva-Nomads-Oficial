/*
  E323 — a foto nunca fica em branco: otimizada → direta (uma vez) → "Foto indisponível".
  Roda: node --test src/lib/fotos/tentativa-imagem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proximaTentativa, ROTULO_FOTO_INDISPONIVEL } from "./tentativa-imagem.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a sequência: otimizada → direta → falhou (e para em falhou)", () => {
  assert.equal(proximaTentativa("otimizada"), "direta");
  assert.equal(proximaTentativa("direta"), "falhou");
  assert.equal(proximaTentativa("falhou"), "falhou");
  assert.equal(ROTULO_FOTO_INDISPONIVEL, "Foto indisponível");
});

test("BrandImage: trata o erro, tenta direto sem o otimizador e mostra o espaço reservado (nunca o branco)", () => {
  const s = ler("src/components/brand-image.tsx");
  assert.match(s, /^"use client";/);
  assert.match(s, /onError=\{\(\) => setEstado\(\{ src, tentativa: proximaTentativa\(tentativa\) \}\)\}/);
  assert.match(s, /unoptimized=\{tentativa === "direta"\}/);
  assert.match(s, /data-testid="foto-indisponivel"/);
  // Trocar a foto recomeça do otimizado (a falha de uma foto não contamina a próxima).
  assert.match(s, /const tentativa = estado\.src === src \? estado\.tentativa : "otimizada";/);
});
