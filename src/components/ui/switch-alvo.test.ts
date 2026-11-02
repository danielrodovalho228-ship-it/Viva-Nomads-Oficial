/* Roda: node --test src/components/ui/switch-alvo.test.ts — varredura 01/11 (Pista A): o Switch compartilhado (Conta ›
   Notificações, Pedidos, "Ativo" em Meus imóveis) tinha 24 px de altura de toque no celular. Ganha a área de 44 px de
   .alvo-toque (pseudo-elemento só em tela de toque); o trilho e a bolinha não mudam. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sw = readFileSync(new URL("./switch.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("Switch usa alvo-toque e mantém o trilho de 24 × 44 px", () => {
  assert.match(sw, /"alvo-toque relative inline-flex h-6 w-11 shrink-0/);
  // O ::after é do alvo-toque: o Switch não pode usar ::after para outra coisa.
  assert.doesNotMatch(sw, /after:/);
});

test(".alvo-toque dá 44 px de altura em tela de toque", () => {
  assert.match(css, /@media \(pointer: coarse\)\s*\{\s*\.alvo-toque \{[\s\S]*?\.alvo-toque::after \{[\s\S]*?height: 44px;/);
});
