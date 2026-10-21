/*
  D16 (ordem 56a3a15c): /favoritos existe, o app a abre dentro dele, a aba Favoritos leva a ela
  (deslogado também) e o cabeçalho tem o link "Favoritos (N)".
  Roda: node --test src/lib/favoritos-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { destinoDaRota } from "../config/rotas-app.ts";
import { MORADOR_TABS, tituloDaTelaApp } from "./nav-mobile.ts";

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

test("Prompt 41: Favoritos saiu da barra (5 itens por papel); /favoritos segue aberta pelo coração e pelo cabeçalho", () => {
  assert.ok(!MORADOR_TABS.some((a) => a.href === "/favoritos"));
  assert.equal(tituloDaTelaApp("/favoritos"), "Favoritos");
});
