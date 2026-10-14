/*
  Home (ordem bab1b2aa, prints 01/14/15): hero em largura cheia com UMA busca
  ("Para onde você vai?") e atalhos por categoria que abrem a /buscar filtrada.
  Roda: node --test src/lib/home-busca-principal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("hero: uma busca só, rotulada 'Para onde você vai?', que leva à /buscar?local=", () => {
  const busca = ler("components/home/busca-principal.tsx");
  assert.match(busca, /Para onde você vai\?/);
  assert.match(busca, /htmlFor="busca-principal-local"/);
  assert.match(busca, /inputId="busca-principal-local"/);
  assert.match(busca, /`\/buscar\?\$\{new URLSearchParams\(\{ local: q \}\)\.toString\(\)\}`/);
  // Nada de período / pessoas / orçamento no hero: ficam nos filtros da /buscar.
  assert.doesNotMatch(busca, /<select|GuestsField|Orçamento\/mês/);
  const home = ler("app/(public)/page.tsx");
  assert.equal((home.match(/<BuscaPrincipal \/>/g) ?? []).length, 1);
  assert.doesNotMatch(home, /HeroSearch/);
  assert.ok(!existsSync(new URL("../components/hero-search.tsx", import.meta.url)), "busca antiga de 4 campos removida");
});

test("hero em largura cheia: foto de fundo ocupa a seção; texto centralizado", () => {
  const home = ler("app/(public)/page.tsx");
  const hero = home.slice(home.indexOf('data-testid="hero-home"'), home.indexOf("<AtalhosCategoria />"));
  assert.match(hero, /<HeroVideoBg \/>/);
  assert.match(hero, /text-center/);
  assert.match(hero, /<h1/);
  assert.doesNotMatch(hero, /lg:grid-cols-12/); // não é mais o hero de 2 colunas
});

test("atalhos por categoria usam filtros que a /buscar realmente lê da URL", async () => {
  const { ATALHOS_CATEGORIA } = await import("../config/atalhos-home.ts");
  const rotulos = ATALHOS_CATEGORIA.map((a) => a.rotulo);
  assert.ok(rotulos.includes("Aceita pets"));
  assert.ok(rotulos.includes("3+ quartos"));
  const busca = ler("app/(public)/buscar/search-client.tsx");
  const lidos: Record<string, RegExp> = {
    orcamento: /num\("orcamento"\)/,
    pet: /on\("pet"\)/,
    homeoffice: /on\("homeoffice"\)/,
    quartos: /num\("quartos"\)/,
  };
  for (const a of ATALHOS_CATEGORIA) {
    const u = new URL(a.href, "https://x");
    assert.equal(u.pathname, "/buscar");
    for (const k of u.searchParams.keys()) assert.match(busca, lidos[k] ?? /^$/, `${a.rotulo}: /buscar lê "${k}"`);
    assert.ok(existsSync(new URL(`../../public${a.foto}`, import.meta.url)), `${a.rotulo}: foto existe`);
    assert.ok(a.alt.length > 5);
  }
  // Valores aceitos pela /buscar (a busca ignora outros).
  assert.match(busca, /\[2500, 3500, 5000\]\.includes\(orc\)/);
  assert.match(busca, /\[1, 2, 3\]\.includes\(num\("quartos"\)\)/);
});

test("identidade Viva Nomads: nenhum texto ou marca da referência", () => {
  for (const f of ["app/(public)/page.tsx", "components/home/busca-principal.tsx", "components/home/atalhos-categoria.tsx"]) {
    const s = ler(f);
    assert.doesNotMatch(s, /Furnished|booking fees|Budget-friendly|Pet-friendly/i, f);
    assert.doesNotMatch(s, /\balugu?el\b/i, f);
  }
});
