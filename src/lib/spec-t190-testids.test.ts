/*
  Estático (faixa C, achado do Moacir no #549): todo data-testid que a spec t190 exige no HTML de /cidades/<cidade>
  tem de existir na página. O t190 esperava "valor-medio-cidade", que não existe (o bloco é "precos-medios" e só
  aparece com média real, 3+ anúncios). Roda: node --experimental-strip-types --test src/lib/spec-t190-testids.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const spec = readFileSync(join(raiz, "tests/e2e/specs/t190-seo-robots-jsonld.spec.ts"), "utf8");
const pagina = readFileSync(join(raiz, "src/app/(public)/cidades/[cidade]/page.tsx"), "utf8");

test("t190: cada data-testid esperado no HTML da cidade existe na página", () => {
  const ids = [...spec.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.includes("faq-cidade"));
  const faltando = [...new Set(ids)].filter((id) => !pagina.includes(`data-testid="${id}"`));
  assert.deepEqual(faltando, []);
});

test("t190: o valor médio é opcional na spec (só aparece com 3+ anúncios)", () => {
  assert.doesNotMatch(spec, /expect\(html\)\.toContain\('data-testid="precos-medios"'\)/);
});
