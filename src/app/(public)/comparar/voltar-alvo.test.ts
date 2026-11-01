/* Roda: node --test "src/app/(public)/comparar/voltar-alvo.test.ts" — varredura 01/11 (Pista A): em /comparar o link solto
   "Voltar à busca" media 24 px de altura no celular; ganha a área de toque de 44 px (.alvo-toque) sem mudar o visual. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("os dois 'Voltar à busca' usam alvo-toque", () => {
  const links = src.match(/<Link href="\/buscar" className="[^"]*">\s*Voltar à busca/g) ?? [];
  assert.equal(links.length, 2);
  for (const l of links) assert.match(l, /\balvo-toque\b/);
});
