/* Roda: node --test src/lib/dv-meus-imoveis-link.test.ts — D-V7: Meus imóveis não leva à página pública de anúncio que não está no ar (404 na t249). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");

test("Meus imóveis: só o anúncio no ar tem título-link e 'Ver'; rascunho e pausado têm o título em texto", () => {
  const lista = ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(lista, /\{demoItem \|\| p\.status !== "active" \? \(\s*<span className="mt-2 font-title text-lg font-semibold text-ink">\{p\.title\}<\/span>/);
  assert.match(lista, /\{p\.status === "active" && \(\s*<ButtonLink href=\{`\/imoveis\/\$\{p\.id\}`\}/);
  assert.match(lista, /`\/dashboard\/imoveis\/novo\?draft=\$\{p\.id\}`/, "rascunho segue com 'Continuar editando'");
});

test("a página pública só mostra anúncio ativo (a regra que o título acompanha)", () => {
  assert.match(ler("lib/data/properties.ts"), /\.eq\("status", "active"\)/);
});
