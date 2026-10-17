import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehAnuncioDeTeste } from "./demo-listing.ts";

test("#fa84ea52: título [TESTE] é anúncio de teste; título normal não", () => {
  assert.equal(ehAnuncioDeTeste("[TESTE] Kitnet no Santa Mônica"), true);
  assert.equal(ehAnuncioDeTeste("  [teste] apto"), true);
  assert.equal(ehAnuncioDeTeste("Apartamento perto do HC-UFU"), false);
  assert.equal(ehAnuncioDeTeste("Meu teste de [TESTE] no meio"), false);
  assert.equal(ehAnuncioDeTeste(null), false);
});

test("#fa84ea52: sitemap exclui e página do imóvel marca noindex os anúncios de teste", () => {
  assert.match(readFileSync("src/app/sitemap.ts", "utf8"), /ehAnuncioDeTeste\(p\.title\)/);
  assert.match(readFileSync("src/app/(public)/imoveis/[id]/page.tsx", "utf8"), /ehAnuncioDeTeste\(property\.title\)/);
});
