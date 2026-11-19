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


/*
  E960, devolução de 19/11. A classe `alvo-toque` só estende a área em tela de toque, por um ::after; o retângulo da
  própria âncora continuava com 32 px, e foi isso que o Gerente mediu em produção (153 × 32 px). A âncora passa a ter
  44 px de altura mínima nela própria, em qualquer tela. O desenho não muda: a raiz do Logo centra o símbolo e o nome.
*/
test("E960 (devolução): a âncora do logo do Navbar tem 44 px de altura mínima nela própria", () => {
  const logo = navbar.match(/<Logo\b[^>]*\/>/);
  assert.ok(logo, "o Navbar desenha o <Logo />");
  assert.match(logo![0], /className="[^"]*\bmin-h-11\b[^"]*"/, "min-h-11 = 44 px, na própria âncora");
  const fonteDoLogo = readFileSync("src/components/ui/logo.tsx", "utf8");
  assert.match(fonteDoLogo, /<Link href=\{href\}[^>]*className=\{cn\("inline-flex items-center gap-2", className\)\}/, "a âncora centra o símbolo e o nome na vertical");
});
