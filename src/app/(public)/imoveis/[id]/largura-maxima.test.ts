import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Ordem 4252e0d6: página pública do imóvel contida em 1536 px (ordem e8e901b8 trocou 1280 por 1536), galeria com altura fixa de 480 px. */
const detalhe = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
const galeria = readFileSync("src/components/property-gallery.tsx", "utf8");

test("container da página do imóvel é centralizado e limitado a 1536 px", () => {
  const linha = detalhe.split("\n").find((l) => l.includes('data-testid="imovel-largura-total"')) ?? "";
  assert.match(linha, /mx-auto/);
  assert.match(linha, /max-w-\[1536px\]/);
  assert.match(linha, /\bw-full\b/);
});

test("galeria no computador: altura fixa de 480 px nos três formatos de mosaico", () => {
  const n = (galeria.match(/(grid|<div className="|\s)h-\[480px\]/g) ?? []).length;
  assert.equal(n, 3);
});

test("galeria no celular continua em largura total (carrossel sem max-w)", () => {
  const carrossel = galeria.slice(galeria.indexOf("function MobileCarousel"), galeria.indexOf("function DesktopMosaic"));
  assert.doesNotMatch(carrossel, /max-w-/);
});
