/*
  E1029 (L-22, t311) — um só marco principal por página pública.
  O layout das páginas públicas (src/app/(public)/layout.tsx) já abre <main id="conteudo">. Cinco páginas punham outro
  <main> dentro dele: /conferir, /conferir/[codigo], /alerta-busca/desligar e, na extensão da ORDEM-DUET-130,
  /avisos/desligar e /avaliadores/[numero]. Isso dava dois marcos "principal" na mesma página (HTML inválido; o leitor de
  tela anuncia dois e o "pular para o conteúdo" fica ambíguo). As cinco passam a abrir um <div>. O error.tsx público já
  era um <div> e entra aqui para não regredir.
  A procura ignora comentários (o error.tsx explica em comentário por que não usa <main>).
  Roda: node --test src/lib/a11y/e1029-main-unico-publico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../app/(public)/${p}`, import.meta.url), "utf8");

test("E1029 — o layout público abre o único <main> (id=conteudo)", () => {
  const layout = semComentarios(ler("layout.tsx"));
  assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  assert.match(layout, /<main id="conteudo"/);
});

const PAGINAS = [
  "conferir/page.tsx",
  "conferir/[codigo]/page.tsx",
  "alerta-busca/desligar/page.tsx",
  "avisos/desligar/page.tsx",
  "avaliadores/[numero]/page.tsx",
  "error.tsx",
];

for (const pagina of PAGINAS) {
  test(`E1029 — ${pagina} não abre <main> próprio dentro do layout público`, () => {
    const s = semComentarios(ler(pagina));
    assert.doesNotMatch(s, /<main\b/, `${pagina}: <main> dentro do <main id="conteudo"> do layout`);
    assert.doesNotMatch(s, /<\/main>/);
  });
}
