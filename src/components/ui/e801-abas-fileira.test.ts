/*
  E801 (D5): a fileira de abas sublinhadas não abre rolagem vertical nem mostra barra de rolagem.
  Roda: node --test src/components/ui/e801-abas-fileira.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILEIRA_ABAS } from "./abas-fileira.ts";

test("a fileira rola só na horizontal e esconde a barra (o -mb-px das abas não abre rolagem vertical)", () => {
  assert.match(FILEIRA_ABAS, /\boverflow-x-auto\b/);
  assert.match(FILEIRA_ABAS, /\boverflow-y-hidden\b/);
  assert.match(FILEIRA_ABAS, /\[scrollbar-width:none\]/);
  assert.match(FILEIRA_ABAS, /\[&::-webkit-scrollbar\]:hidden/);
});

test("Avaliações e Favoritos usam a fileira única (nenhuma das duas com a classe antiga)", () => {
  for (const p of ["src/components/avaliacoes/painel.tsx", "src/components/dashboard/favoritos-tabs.tsx"]) {
    const s = readFileSync(p, "utf8");
    assert.match(s, /cn\("m[tb]-[46]", FILEIRA_ABAS\)/, p);
    assert.doesNotMatch(s, /flex gap-2 overflow-x-auto border-b border-sage-200"/, p);
  }
});
