/*
  Ordem 0eedfca6: a home não tem depoimento nem avatar genérico enquanto não houver depoimento REAL e autorizado.
  Roda: node --test src/lib/home-sem-prova-social-falsa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("home sem seção 'Quem já usou', avatar.svg ou 'Fotos reais ... em breve'", () => {
  const home = readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /quem já usou/i);
  assert.doesNotMatch(home, /avatar\.svg/);
  assert.doesNotMatch(home, /Fotos reais de hóspedes/i);
  assert.doesNotMatch(home, /depoimento/i);
});
