/* Roda: node --test src/lib/textos-publicos.test.ts
   Guarda de texto das páginas públicas (ordens do Otávio, pacote 12/10 tarde). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho: string) => readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");

test("#67: /precos e /para-proprietarios não prometem seguro-fiança nem 'garante o aluguel'", () => {
  for (const f of ["src/app/(public)/precos/page.tsx", "src/app/(public)/para-proprietarios/page.tsx"]) {
    const t = ler(f);
    assert.doesNotMatch(t, /seguro-fian/i, f);
    assert.doesNotMatch(t, /garante o aluguel/i, f);
    assert.match(t, /não é a garantidora/, f);
    assert.match(t, /Outras modalidades de garantia locatícia: em breve/, f);
  }
});
