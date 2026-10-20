/*
  Estático: "Meus imóveis" busca a lista e o cliente do Supabase em paralelo (ordem 0f66a754, item 4).
  Roda: node --experimental-strip-types --test src/lib/imoveis-paralelo.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pagina = readFileSync(new URL("../app/(dashboard)/dashboard/imoveis/page.tsx", import.meta.url), "utf8");

test("meus imóveis: lista e cliente em Promise.all, sem await em sequência", () => {
  assert.match(pagina, /await Promise\.all\(\[listMyProperties\(\), createClient\(\), meusPedidosDeAjuda\(\)\]\)/);
  assert.doesNotMatch(pagina, /const properties = await listMyProperties\(\)/);
});
