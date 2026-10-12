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

test("#68: keywords globais e textos públicos sem 'aluguel' (fora de citações legais)", () => {
  const layout = ler("src/app/layout.tsx");
  assert.doesNotMatch(layout, /aluguel 30 dias/i);
  assert.match(layout, /locação mobiliada 30 a 180 dias/);
  for (const f of ["src/app/(public)/page.tsx", "src/app/(public)/para-proprietarios/page.tsx", "src/app/(public)/precos/page.tsx"]) {
    assert.doesNotMatch(ler(f), /\balugu?el\b/i, f);
  }
});

test("#69: aviso de testes único, no layout público, sem cópias nas páginas", async () => {
  const { AVISO_TESTES } = await import("./aviso-testes.ts");
  assert.equal(AVISO_TESTES, "Plataforma em fase de testes. Lançamento oficial em 2027.");
  assert.match(ler("src/app/(public)/layout.tsx"), /<AvisoTestes \/>/);
  assert.doesNotMatch(ler("src/app/(public)/layout.tsx"), /em pré-lançamento —/);
  for (const f of ["src/app/(public)/parceiros/page.tsx", "src/app/(public)/guia-fotos/page.tsx", "src/app/(public)/parceiros/fotografos/page.tsx"]) {
    assert.doesNotMatch(ler(f), /fase de testes/i, f);
    assert.doesNotMatch(ler(f), /RODAPE_GUIA/, f);
  }
});
