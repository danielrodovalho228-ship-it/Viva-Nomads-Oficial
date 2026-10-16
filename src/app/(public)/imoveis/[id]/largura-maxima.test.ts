import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Ordem 4252e0d6: página pública do imóvel contida em 1280 px, galeria com altura limitada. */
const detalhe = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
const galeria = readFileSync("src/components/property-gallery.tsx", "utf8");

test("container da página do imóvel é centralizado e limitado a 1280 px", () => {
  const linha = detalhe.split("\n").find((l) => l.includes('data-testid="imovel-largura-total"')) ?? "";
  assert.match(linha, /mx-auto/);
  assert.match(linha, /max-w-\[1280px\]/);
  assert.match(linha, /\bw-full\b/);
});

test("galeria no computador: altura máxima de 520 px nos três formatos de mosaico", () => {
  const n = (galeria.match(/aspect-\[(2\/1|16\/9)\] max-h-\[520px\]/g) ?? []).length;
  assert.equal(n, 3);
});

test("galeria no celular continua em largura total (carrossel sem max-w)", () => {
  const carrossel = galeria.slice(galeria.indexOf("function MobileCarousel"), galeria.indexOf("function DesktopMosaic"));
  assert.doesNotMatch(carrossel, /max-w-/);
});
