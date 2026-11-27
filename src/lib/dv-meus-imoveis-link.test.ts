/* Roda: node --test src/lib/dv-meus-imoveis-link.test.ts — D-V7: Meus imóveis não leva à página pública de anúncio que não está no ar (404 na t249). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");

test("Meus imóveis: só o anúncio no ar aponta para a página pública; rascunho e pausado levam à edição (E510)", () => {
  const lista = ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  // E510: título e foto são links em todo estado, pelo destino único (ativo → página; outros → edição, nunca 404).
  assert.match(lista, /<Link href=\{destino\} className="mt-2 font-title text-lg font-semibold text-ink hover:text-forest" data-testid="cartao-titulo-link">/);
  assert.match(ler("lib/anuncio/destino-cartao.ts"), /if \(p\.status === "active"\) return `\/imoveis\/\$\{p\.id\}`;/);
  assert.match(lista, /\{p\.status === "active" && \(\s*<ButtonLink href=\{`\/imoveis\/\$\{p\.id\}`\}/);
  // E507: "Continuar editando" do rascunho vai pelo destino único de retomada (sempre o assistente, /novo?draft=).
  assert.match(lista, /hrefRetomarRascunho\(prontidao\[p\.id\], p\.id\)/, "rascunho segue com 'Continuar editando'");
});

test("a página pública só mostra anúncio ativo (a regra que o título acompanha)", () => {
  assert.match(ler("lib/data/properties.ts"), /\.eq\("status", "active"\)/);
});
