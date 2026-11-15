import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  E949 — o "Pular para o conteúdo principal" aterrava escondido sob o cabeçalho fixo.
  O <main id="conteudo"> começa logo abaixo do cabeçalho público, que é preso no topo (72 px + 1 px de borda). Ao seguir
  o link, o navegador rolava até o topo do <main> encostar no topo da janela, e os primeiros 73 px do conteúdo ficavam
  atrás do cabeçalho (medido no laboratório em /parceiros, /, /ajuda, /como-funciona, /para-proprietarios e /buscar, a
  390 e a 1280 px; na home o título ficava a 48 px, coberto). O foco também não saía do <body>.
  Correção: margem de rolagem no alvo, do tamanho do cabeçalho, e o <main> recebe o foco (tabIndex -1).
  Na tela: t1663.
*/
const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/(public)/layout.tsx", "utf8");
const navbar = readFileSync("src/components/layout/navbar.tsx", "utf8");

test("E949: o alvo do skip-link para abaixo do cabeçalho público (margem de rolagem = altura do cabeçalho)", () => {
  const m = css.match(/html:not\(\[data-app\]\) #conteudo \{\s*scroll-margin-top: calc\((\d+(?:\.\d+)?)rem \+ 1px\);/);
  assert.ok(m, "regra de scroll-margin-top no #conteudo, só no site (no app o cabeçalho é outro: E678)");
  // O cabeçalho público é o Navbar: h-18 (4,5 rem) com 1 px de borda. Se a altura dele mudar, esta margem muda junto.
  assert.match(navbar, /<nav className="flex h-18 /);
  assert.match(navbar, /<header className=\{cn\("sticky top-0 z-40 border-b /);
  assert.equal(Number(m![1]), 18 / 4, "h-18 = 4,5 rem");
});

test("E949: o <main> do site recebe o foco do skip-link, sem contorno", () => {
  assert.match(layout, /<a href="#conteudo" className="skip-link">/);
  assert.match(layout, /<main id="conteudo" tabIndex=\{-1\} className="[^"]*\boutline-none\b[^"]*">/);
});
