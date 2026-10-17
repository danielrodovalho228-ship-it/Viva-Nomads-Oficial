/*
  D16 (ordem 56a3a15c): /favoritos existe, o app a abre dentro dele, a aba Favoritos leva a ela
  (deslogado também) e o cabeçalho tem o link "Favoritos (N)".
  Roda: node --test src/lib/favoritos-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { destinoDaRota } from "../config/rotas-app.ts";
import { TENANT_TABS, TENANT_APP_TABS, ehAbaRaizApp, tituloDaTelaApp } from "./nav-mobile.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a rota pública /favoritos existe, não indexa e usa a lista do coração", () => {
  assert.ok(existsSync(new URL("../app/(public)/favoritos/page.tsx", import.meta.url)));
  const pagina = ler("../app/(public)/favoritos/page.tsx");
  assert.match(pagina, /robots:\s*{\s*index:\s*false/);
  const lista = ler("../components/favoritos-lista.tsx");
  assert.match(lista, /useFavoritos/);
  assert.match(lista, /data-testid="favoritos-vazio"/);
  assert.match(lista, /href="\/buscar"/);
});

test("página pública e painel usam o mesmo hook (sem duplicar código)", () => {
  assert.match(ler("../lib/use-favoritos.ts"), /useFavoritesStore/);
  assert.match(ler("../components/favoritos-lista.tsx"), /useFavoritos\(\)/);
  assert.match(ler("../app/(dashboard)/dashboard/favoritos/page.tsx"), /useFavoritos\(\)/);
});

test("o app abre /favoritos dentro dele; /favoritosx continua no site", () => {
  assert.equal(destinoDaRota("/favoritos"), "app");
  assert.equal(destinoDaRota("/favoritosx"), "site");
});

test("aba Favoritos leva a /favoritos sem exigir login (site e app)", () => {
  for (const abas of [TENANT_TABS, TENANT_APP_TABS]) {
    const aba = abas.find((a) => a.label === "Favoritos");
    assert.equal(aba?.href, "/favoritos");
    assert.ok(!aba?.authRequired);
  }
  assert.ok(ehAbaRaizApp("/favoritos"));
  assert.equal(tituloDaTelaApp("/favoritos"), "Favoritos");
});

test("cabeçalho tem o link Favoritos com contador e o coração informa o estado", () => {
  const navbar = ler("../components/layout/navbar.tsx");
  assert.match(navbar, /data-testid="link-favoritos"/);
  assert.match(navbar, /href="\/favoritos"/);
  assert.match(ler("../components/favorite-button.tsx"), /aria-label=\{isFavorite \? "Remover dos favoritos" : "Adicionar aos favoritos"\}/);
});
