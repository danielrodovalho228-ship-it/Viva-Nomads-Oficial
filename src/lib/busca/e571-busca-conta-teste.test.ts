/*
  E571 (decisão do Daniel, 04/11/2026): a busca inclui os anúncios de teste ativos SÓ para a conta de teste logada;
  visitante e conta real seguem sem eles. Os cartões, filtros e contadores da /buscar saem da mesma lista.
  Roda: node --test src/lib/busca/e571-busca-conta-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("a página da busca decide no servidor e passa incluirTeste só para a conta de teste", () => {
  const pg = ler("src/app/(public)/buscar/page.tsx");
  assert.match(pg, /const incluirTeste = await buscaComAnunciosDeTeste\(\);/);
  assert.match(pg, /listProperties\(\{ incluirTeste \}\)/);
  // O dado estruturado é público: nunca leva anúncio de teste.
  assert.match(pg, /listaImoveis\(SITE_URL, properties\.filter\(\(p\) => !p\.deTeste\)/);
});

test("conta de teste = profiles.is_teste === true, lido no servidor; qualquer falha ou sem login = false", () => {
  const s = ler("src/lib/data/busca-teste.ts");
  assert.match(s, /^import "server-only";/);
  assert.match(s, /if \(!user\) return false;/);
  assert.match(s, /select\("is_teste"\)\.eq\("id", user\.id\)/);
  assert.match(s, /\?\.is_teste === true;/);
  assert.match(s, /catch \{\n\s*return false;/);
  assert.doesNotMatch(s, /role|admin ===/, "admin sem a marca de teste não vê (só is_teste)");
});

test("lista: sem a opção, a vitrine de sempre (sem anúncio de teste); com ela, os de teste marcados com deTeste", () => {
  const d = ler("src/lib/data/properties.ts");
  assert.match(d, /export async function listProperties\(opcoes: \{ incluirTeste\?: boolean \} = \{\}\)/);
  assert.match(d, /semAnunciosDeTesteNaVitrine\(data as unknown as PropertyRow\[\], opcoes\.incluirTeste === true\)/);
  assert.match(d, /if \(incluirTeste\) return comAnunciosDeTesteMarcados\(linhas\);/);
  assert.match(d, /\{ \.\.\.p, deTeste: true \}/);
  // As outras telas públicas chamam sem a opção (nada muda para elas).
  for (const f of ["src/app/(public)/page.tsx", "src/app/sitemap.ts", "src/app/api/properties/route.ts", "src/app/not-found.tsx"]) {
    assert.doesNotMatch(ler(f), /incluirTeste/, f);
  }
});
