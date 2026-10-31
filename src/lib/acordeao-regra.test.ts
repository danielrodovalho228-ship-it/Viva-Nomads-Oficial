/* Roda: node --test src/lib/acordeao-regra.test.ts — regra do E186 (Muse, 31/10) nas páginas PÚBLICAS: acordeão só dentro
   das páginas de tema da Central de Ajuda; nas demais, as seções são blocos abertos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E186: /empresas sem acordeão — as Perguntas rápidas são blocos com a resposta à vista", () => {
  const f = ler("src/app/(public)/empresas/page.tsx");
  assert.doesNotMatch(f, /<details|<summary/);
  assert.match(f, /data-testid="empresas-faq-item"/);
});

test("E186: na página do imóvel as SEÇÕES são blocos abertos (os <details> que restam são 'saiba mais' dentro de um bloco)", () => {
  const f = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  for (const id of ["visao-geral", "comodidades", "disponibilidade", "localizacao", "avaliacoes"]) assert.match(f, new RegExp(`<div id="${id}"`), id);
  // Só o "Detalhes dos valores" do diálogo da candidatura; nenhuma seção da página em acordeão.
  assert.equal((f.match(/<details/g) ?? []).length, 1);
  assert.match(f, /<details[^>]*data-testid="candidatura-detalhes"/);
});

test("E186: a Central de Ajuda é o único lugar com perguntas em acordeão (as páginas de tema)", () => {
  const central = ler("src/components/ajuda/central-ajuda.tsx");
  assert.match(central, /aria-expanded=\{aberta === p\.id\}/);
  assert.match(ler("src/app/(public)/ajuda/[tema]/page.tsx"), /<PerguntasDaCentral ids=\{tema\.perguntas\}/);
  // O hub /ajuda não lista perguntas (só os cartões dos temas).
  assert.doesNotMatch(ler("src/app/(public)/ajuda/page.tsx"), /<PerguntasDaCentral/);
});
