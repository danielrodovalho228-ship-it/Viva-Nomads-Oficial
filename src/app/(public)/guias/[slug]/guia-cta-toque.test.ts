/*
  Varredura 02/11 (Pista A): no fim de cada guia, "Buscar imóveis mobiliados" e "Anunciar o meu imóvel" tinham 24 px
  de altura e ficavam a 12 px um do outro no celular. Agora cada link tem 44 px (min-h-11).
  Roda: node --test "src/app/(public)/guias/[slug]/guia-cta-toque.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("os dois links do fim do guia têm 44 px de altura", () => {
  for (const id of ["guia-cta-buscar", "guia-cta-anunciar"]) {
    assert.match(src, new RegExp(`className="inline-flex min-h-11 items-center font-semibold text-forest underline" data-testid="${id}"`));
  }
});
