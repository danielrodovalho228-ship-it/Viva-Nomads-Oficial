/* Roda: node --test src/lib/dv-meus-imoveis-link.test.ts — D-V: Meus imóveis não leva a página pública de anúncio que não está no ar (404 na t249). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");

test("Meus imóveis: anúncio ativo abre a página pública; rascunho e pausado abrem a edição", () => {
  const lista = ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(lista, /href=\{p\.status === "active" \? `\/imoveis\/\$\{p\.id\}` : `\/dashboard\/imoveis\/\$\{p\.id\}\/editar`\}/);
  assert.match(lista, /\{p\.status === "active" && \(\s*<ButtonLink href=\{`\/imoveis\/\$\{p\.id\}`\}/);
});

test("a página pública só mostra anúncio ativo (a regra que o link acompanha)", () => {
  assert.match(ler("lib/data/properties.ts"), /\.eq\("status", "active"\)/);
});
