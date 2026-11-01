import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("ajuda-central (mockup): títulos dos temas e das seções em verde, tema um passo maior", () => {
  const a = ler("app/(public)/ajuda/page.tsx");
  assert.match(a, /font-title text-xl font-semibold text-forest">\{t\.titulo\}/);
  assert.match(a, /id="ajuda-temas-titulo" className="font-title text-xl font-semibold text-forest"/);
  assert.match(a, /id="ajuda-docs-titulo" className="font-title text-xl font-semibold text-forest"/);
});

test("busca-card (mockup): na contagem, o lugar em verde sem mudar o texto", () => {
  const b = ler("app/(public)/buscar/search-client.tsx");
  assert.match(b, /texto\.lastIndexOf\(" em "\)/);
  assert.match(b, /<span className="text-forest" data-testid="titulo-busca-local">/);
});
