import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  E960 — o logo do cabeçalho público tem alvo de toque de 44 px.
  A varredura de 02/11 deu ao logo da 404 (32 px de altura) a classe `alvo-toque` (área de 44 px só em tela de toque,
  sem mudar o visual). O E916 (15/11) trocou o cabeçalho próprio da 404 pelo Navbar padrão, cujo logo não tinha a
  classe, e o alvo caiu para 32 px na 404 e em toda página pública. A classe mora no logo do Navbar.
  O t815 mede o alvo na tela (390 px, toque).
*/
const navbar = readFileSync("src/components/layout/navbar.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("E960: o logo do Navbar leva a classe alvo-toque", () => {
  const logo = navbar.match(/<Logo\b[^>]*\/>/);
  assert.ok(logo, "o Navbar desenha o <Logo />");
  assert.match(logo![0], /className="[^"]*\balvo-toque\b[^"]*"/, "logo do cabeçalho público com alvo de 44 px no toque");
});

test("E960: alvo-toque segue dando 44 px de altura só em tela de toque", () => {
  const bloco = css.slice(css.indexOf("@media (pointer: coarse) {\n  .alvo-toque {"));
  assert.ok(bloco.startsWith("@media (pointer: coarse)"), "a regra vive dentro de pointer: coarse");
  assert.match(bloco.slice(0, 400), /\.alvo-toque::after\s*\{[^}]*height:\s*44px/);
});
