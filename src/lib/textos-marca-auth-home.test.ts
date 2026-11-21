import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

test("/auth: texto alternativo segue a marca (imóvel mobiliado, nunca apartamento)", () => {
  const s = ler("app/auth/page.tsx");
  assert.doesNotMatch(s, /apartamentos? mobiliados?/i);
  assert.match(s, /em um imóvel mobiliado e tranquilo/);
});

test("home passo 3: a caução vem de CAUCAO_FRASE (E962), sem 'Garantia escolhida' solta (#48)", () => {
  const s = ler("app/(public)/page.tsx");
  assert.doesNotMatch(s, /Garantia escolhida/);
  // Asserção alterada (E962): a frase solta "Caução combinada…" deu lugar à CAUCAO_FRASE importada.
  assert.match(s, /\$\{CAUCAO_FRASE\}/);
});

test("textos alternativos das páginas públicas e do onboarding: 'imóvel mobiliado', nunca 'apartamento' (ordem 809fcade)", () => {
  for (const arq of [
    "app/(public)/como-funciona/page.tsx",
    "app/(public)/empresas/page.tsx",
    "app/(public)/precos/page.tsx",
    "app/(public)/para-proprietarios/page.tsx",
    "components/onboarding/checklist-ativacao.tsx",
    "lib/onboarding/ativacao.ts",
  ]) {
    assert.doesNotMatch(ler(arq), /apartamentos? mobiliados?/i, arq);
  }
  assert.match(ler("app/(public)/empresas/page.tsx"), /a um imóvel mobiliado com a mala/);
});
