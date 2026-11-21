import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Passada 68: o link "← Meus imóveis" das subpáginas do imóvel media 20 px de altura (390 e 1280): abaixo dos 44 px de toque.
for (const sub of ["parceiros", "desempenho", "nivel", "cartao", "conforto"]) {
  test(`o voltar de /dashboard/imoveis/[id]/${sub} tem alvo de 44 px`, () => {
    const src = readFileSync(`src/app/(dashboard)/dashboard/imoveis/[id]/${sub}/page.tsx`, "utf8");
    const link = src.match(/<Link href="\/dashboard\/imoveis" className="([^"]+)"/)?.[1] ?? "";
    assert.match(link, /\bmin-h-11\b/);
  });
}

test('o link "Ver como aparece na busca" do editar anúncio tem alvo de 44 px', () => {
  const src = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", "utf8");
  assert.match(src, /href=\{publicUrl\}\s+className="[^"]*\bmin-h-11\b[^"]*"/);
});
