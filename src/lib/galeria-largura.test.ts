import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Ordem e8e901b8 (P0, Daniel 16/10): contêiner de 1536 px com padding de 28 px,
 * mosaico de 480 px de altura e foto do lightbox com altura real (object-contain).
 */
const galeria = readFileSync("src/components/property-gallery.tsx", "utf8");
const detalhe = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
const marca = readFileSync("src/components/brand-image.tsx", "utf8");

test("página do imóvel: contêiner max-w-[1536px] com lg:px-7", () => {
  const caixa = detalhe.match(/<div className="[^"]*"\s+data-testid="imovel-largura-total">/)?.[0] ?? "";
  assert.match(caixa, /max-w-\[1536px\]/);
  assert.match(caixa, /lg:px-7/);
  assert.doesNotMatch(caixa, /max-w-\[1280px\]/);
});

test("mosaico do desktop tem altura fixa de 480 px (nenhuma variante usa aspect/max-h)", () => {
  assert.equal((galeria.match(/h-\[480px\]/g) ?? []).length, 3);
  assert.doesNotMatch(galeria, /max-h-\[520px\]/);
});

test("lightbox: a foto tem altura real e usa object-contain", () => {
  const linha = galeria.match(/<BrandImage[^\n]*foto \$\{index \+ 1\}[^\n]*/)?.[0] ?? "";
  assert.match(linha, /fit="object-contain"/);
  assert.match(linha, /h-\[80vh\]/);
  assert.doesNotMatch(linha, /max-h-\[80vh\]/);
});

test("BrandImage aceita fit e mantém object-cover como padrão", () => {
  assert.match(marca, /fit = "object-cover"/);
  assert.match(marca, /className=\{fit\}/);
});
