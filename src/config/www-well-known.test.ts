/*
  App Links (Android) e AASA (Apple) não aceitam redirect em /.well-known/*. O www vai para o ápice em todo o
  resto do site, mas /.well-known/* é servido direto (200) nos dois hosts. Usa o casador de rotas do próprio Next.
  Roda: node --test src/config/www-well-known.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");

interface Redirect {
  source: string;
  destination: string;
  has?: { type: string; value?: string }[];
}

async function destinoNoWww(caminho: string): Promise<string | null> {
  const m = await import("../../next.config.ts");
  const lista: Redirect[] = await m.default.redirects!();
  for (const r of lista.filter((x) => x.has?.some((h) => h.type === "host" && h.value === "www.vivanomads.com.br"))) {
    const p = getPathMatch(r.source, { strict: true, removeUnnamedParams: true, regexModifier: (s: string) => s })(caminho);
    if (p) return r.destination.replace(":caminho", p.caminho ?? "");
  }
  return null;
}

test("www: /.well-known/* fica no próprio host (sem redirect)", async () => {
  assert.equal(await destinoNoWww("/.well-known/assetlinks.json"), null);
  assert.equal(await destinoNoWww("/.well-known/apple-app-site-association"), null);
  assert.equal(await destinoNoWww("/.well-known"), null);
});

test("www: o resto do site vai para o ápice, no mesmo caminho", async () => {
  assert.equal(await destinoNoWww("/"), "https://vivanomads.com.br/");
  assert.equal(await destinoNoWww("/buscar"), "https://vivanomads.com.br/buscar");
  assert.equal(await destinoNoWww("/imoveis/abc/fotos"), "https://vivanomads.com.br/imoveis/abc/fotos");
  assert.equal(await destinoNoWww("/.well-knownx"), "https://vivanomads.com.br/.well-knownx");
});
