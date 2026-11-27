/* Roda: node --test src/components/anuncio/e512-menu-estado.test.ts — E512: o menu Pausar/Reativar não cobre o título do cartão. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const c = readFileSync(new URL("./estado-anuncio.tsx", import.meta.url), "utf8");

test("E512: o menu do selo abre no fluxo (linha própria abaixo do selo), não por cima do título", () => {
  const menu = c.slice(c.indexOf('role="menu"') - 200, c.indexOf('role="menu"') + 300);
  assert.doesNotMatch(menu, /\babsolute\b/);
  assert.match(c, /<div ref=\{menuRef\} role="menu" className="w-full basis-full/);
  assert.match(c, /data-testid="estado-anuncio-menu"/);
});

test("E512: tocar no menu não conta como 'fora' (o menu tem a própria referência)", () => {
  assert.match(c, /!raiz\.current\?\.contains\(alvo\) && !menuRef\.current\?\.contains\(alvo\)/);
});
