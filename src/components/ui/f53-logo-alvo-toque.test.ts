import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Varredura 53 (07/11): o link do logo media 32 px de altura a 390 px (/auth, topo do painel) — abaixo de 44 px de toque.
// `alvo-toque` amplia a área de toque a 44 px em tela de toque sem mexer no desenho.
const src = readFileSync(new URL("./logo.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("o link do logo tem a área de toque ampliada (alvo-toque)", () => {
  assert.match(src, /<Link href=\{href\} className=\{cn\("alvo-toque inline-flex items-center gap-2", className\)\}/);
});

test("alvo-toque dá 44 px de altura só em ponteiro de toque", () => {
  assert.match(css, /@media \(pointer: coarse\) \{\s*\.alvo-toque \{\s*position: relative;/);
  assert.match(css, /\.alvo-toque::after \{[^}]*height: 44px;/);
});

test("a versão sem link (assistente) segue sem alvo de toque", () => {
  const semLink = src.slice(src.indexOf("if (href === null)"), src.indexOf("return (\n    // O nome"));
  assert.doesNotMatch(semLink, /alvo-toque/);
});
