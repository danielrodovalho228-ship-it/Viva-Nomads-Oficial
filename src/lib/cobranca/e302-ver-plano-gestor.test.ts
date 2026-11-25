/*
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o link "Ver o Plano Gestor" e a seção #plano-gestor de /precos saíram;
  no lugar, a seção #carteiras ("Carteiras e administradoras") com a linha única das carteiras (TEXTO_CARTEIRAS).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E302/078: /precos não tem mais 'Ver o Plano Gestor'; a âncora da página é #carteiras, com a linha das carteiras, junto do pedido de contato", () => {
  const p = readFileSync(new URL("../../app/(public)/precos/page.tsx", import.meta.url), "utf8");
  // 078 (Daniel, 16/11/2026): antes a página TINHA o link <ButtonLink href="#plano-gestor" … data-testid="precos-ver-plano-gestor">Ver o
  // Plano Gestor; o link saiu com o plano — a página não tem o botão, o texto nem a âncora antiga.
  assert.doesNotMatch(p, /precos-ver-plano-gestor|Ver o Plano Gestor|href="#plano-gestor"/);
  // 078 (Daniel, 16/11/2026): antes /id="plano-gestor"/ — a seção virou #carteiras ("Carteiras e administradoras"), com TEXTO_CARTEIRAS.
  assert.doesNotMatch(p, /id="plano-gestor"|plano-gestor-secao|plano-gestor-texto|plano-gestor-diferenciais/);
  assert.match(p, /<div id="carteiras"[^>]*data-testid="carteiras-secao">\s*<h3[^>]*>Carteiras e administradoras<\/h3>\s*<p[^>]*data-testid="carteiras-texto">\{TEXTO_CARTEIRAS\}<\/p>/);
  assert.match(p, /<PlanoGestorForm \/>/);
});
