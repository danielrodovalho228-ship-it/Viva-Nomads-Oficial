/* Roda: node --test src/components/dashboard/buscas-salvas-uma-barra.test.ts
  Varredura 17 (05/11, 390 e 1280): em Buscas salvas apareciam DUAS barras de abas empilhadas — as subabas do morador
  (Buscar · Favoritos · Buscas salvas, config/abas-painel.ts) e a FavoritosTabs antiga (Favoritos · Comparações · Buscas
  salvas), que a 390 saía cortada ("Buscas s…"). Buscas salvas fica só com a subaba do menu; a FavoritosTabs guarda o
  par que a subaba não separa (Favoritos · Comparações), nas duas páginas dele.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("Buscas salvas não repete a navegação: sem FavoritosTabs (a subaba do menu já leva lá)", () => {
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/buscas/page.tsx"), /FavoritosTabs/);
  assert.match(ler("src/config/abas-painel.ts"), /\{ id: "buscas", rotulo: "Buscas salvas", href: "\/dashboard\/buscas" \}/);
});

test("FavoritosTabs: só Favoritos · Comparações — sem repetir Buscas salvas", () => {
  const s = ler("src/components/dashboard/favoritos-tabs.tsx");
  assert.doesNotMatch(s, /\/dashboard\/buscas/);
  assert.match(s, /\/dashboard\/favoritos/);
  assert.match(s, /\/dashboard\/comparar/);
  for (const r of ["favoritos", "comparar"]) assert.match(ler(`src/app/(dashboard)/dashboard/${r}/page.tsx`), /<FavoritosTabs \/>/);
});
