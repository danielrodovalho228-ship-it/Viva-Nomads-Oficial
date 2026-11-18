/*
  E1029 (L-22, t311) — um só marco principal por página pública.
  O layout das páginas públicas (src/app/(public)/layout.tsx) já abre <main id="conteudo">. /conferir, /conferir/[codigo]
  e /alerta-busca/desligar punham outro <main> dentro dele: dois marcos "principal" na mesma página (HTML inválido; o
  leitor de tela anuncia dois e o "pular para o conteúdo" fica ambíguo). As três páginas passam a abrir um <div>.
  Roda: node --test src/lib/a11y/e1029-main-unico-publico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../app/(public)/${p}`, import.meta.url), "utf8");

test("E1029 — o layout público abre o único <main> (id=conteudo)", () => {
  const layout = ler("layout.tsx");
  assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  assert.match(layout, /<main id="conteudo"/);
});

for (const pagina of ["conferir/page.tsx", "conferir/[codigo]/page.tsx", "alerta-busca/desligar/page.tsx"]) {
  test(`E1029 — ${pagina} não abre <main> próprio dentro do layout público`, () => {
    const s = ler(pagina);
    assert.doesNotMatch(s, /<main\b/, `${pagina}: <main> dentro do <main id="conteudo"> do layout`);
    assert.doesNotMatch(s, /<\/main>/);
  });
}
