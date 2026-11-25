/*
  Varredura 02/11 (Pista A), achados a 390 px:
  1. 404: o logo (32 px) e "É proprietário? Anuncie seu imóvel →" (20 px) sem área de toque de 44 px.
  2. 404 no tablet (2 colunas): os 3 imóveis em destaque deixavam um buraco — em 2 colunas aparecem 2.
  3. Perfil do proprietário (real e de exemplo): o link "4,7 · 11 avaliações" com 20 px.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("404: logo e link de anunciar com alvo de 44 px; destaques em grade par no tablet", () => {
  const src = ler("./not-found.tsx");
  assert.match(src, /<Logo href="\/" className="alvo-toque" \/>/);
  assert.match(src, /className="alvo-toque mt-12 text-sm text-muted hover:text-blue-500"\n\s*data-testid="nao-encontrada-anunciar"/);
  assert.match(src, /sm:grid-cols-2 sm:max-lg:\[&>:nth-child\(3\)\]:hidden lg:grid-cols-3/);
});

test("perfil do proprietário (real e exemplo): link das avaliações com alvo de 44 px", () => {
  for (const f of ["./(public)/proprietario/[id]/page.tsx", "./(public)/proprietario/[id]/perfil-exemplo.tsx"]) {
    assert.match(ler(f), /<a href="#avaliacoes" className="alvo-toque inline-flex items-center gap-1[^"]*" data-testid="perfil-link-avaliacoes">/, f);
  }
});
