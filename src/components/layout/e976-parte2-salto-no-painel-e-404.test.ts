/*
  E976, parte 2 (ronda do Gerente de 03:49Z de 16/11/2026) — o painel logado nunca teve o link "Pular para o conteúdo
  principal", e a página 404 tinha o destino (#conteudo) mas não o link. Mesma família do WCAG 2.4.1: em toda tela com
  cabeçalho e menus antes do conteúdo, o primeiro Tab oferece o salto.
  Roda: node --test src/components/layout/e976-parte2-salto-no-painel-e-404.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../../lib/fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E976-2: o link de salto é um componente só, com o mesmo texto e destino do site público", () => {
  const c = ler("src/components/layout/pular-para-conteudo.tsx");
  assert.match(c, /<a href="#conteudo" className="skip-link">\s*Pular para o conteúdo principal\s*<\/a>/);
  assert.match(ler("src/app/(public)/layout.tsx"), /<a href="#conteudo" className="skip-link">\s*Pular para o conteúdo principal\s*<\/a>/);
  assert.doesNotMatch(c, /<a[^>]*tabIndex/, "o link segue a ordem natural do Tab");
});

test("E976-2: na casca do painel o link de salto é o primeiro elemento, e o conteúdo é o destino focável", () => {
  const casca = semComentarios(ler("src/components/layout/dashboard-shell.tsx"));
  const retorno = casca.slice(casca.lastIndexOf("return ("));
  const raiz = retorno.indexOf("<div");
  const depoisDaRaiz = retorno.slice(retorno.indexOf(">", raiz) + 1).trimStart();
  assert.ok(depoisDaRaiz.startsWith("<PularParaConteudo />"), "o primeiro filho da casca é o link de salto");
  assert.equal(casca.split("<PularParaConteudo />").length - 1, 1);
  assert.match(casca, /<main key=\{mode\} id="conteudo" tabIndex=\{-1\} data-painel-main className="[^"]*\boutline-none\b/);
});

test("E976-2: na 404 o link de salto vem antes do aviso e do cabeçalho, e o conteúdo é o destino focável", () => {
  const p = semComentarios(ler("src/app/not-found.tsx"));
  const retorno = p.slice(p.lastIndexOf("return ("));
  const salto = retorno.indexOf("<PularParaConteudo />");
  assert.ok(salto > 0, "a 404 tem o link de salto");
  for (const depois of ["<AvisoTestes", "<Navbar"]) assert.ok(salto < retorno.indexOf(depois), `o salto vem antes de ${depois}`);
  assert.match(p, /<main id="conteudo" tabIndex=\{-1\} className="[^"]*\boutline-none\b/);
});

test("E976-2: nada de ordem de Tab forçada nas três telas", () => {
  for (const arquivo of ["src/components/layout/dashboard-shell.tsx", "src/app/not-found.tsx", "src/components/layout/pular-para-conteudo.tsx"]) {
    assert.doesNotMatch(ler(arquivo), /tabIndex=\{[1-9]/, arquivo);
  }
});
