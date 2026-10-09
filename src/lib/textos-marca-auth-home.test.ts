import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

test("/auth: texto alternativo segue a marca (imóvel mobiliado, nunca apartamento)", () => {
  const s = ler("app/auth/page.tsx");
  assert.doesNotMatch(s, /apartamentos? mobiliados?/i);
  assert.match(s, /em um imóvel mobiliado e tranquilo/);
});

test("home passo 3: garantia combinada entre as partes, sem 'Garantia escolhida' solta (#48)", () => {
  const s = ler("app/(public)/page.tsx");
  assert.doesNotMatch(s, /Garantia escolhida/);
  assert.match(s, /Garantia locatícia combinada entre proprietário e inquilino \(ex\.: Caução\)/);
});
