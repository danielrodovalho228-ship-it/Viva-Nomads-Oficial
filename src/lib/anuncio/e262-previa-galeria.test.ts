/* Roda: node --test src/lib/anuncio/e262-previa-galeria.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E262 (b): a prévia do Passo 10 ('Ver no tamanho real') mostra os destaques com os dados que o anúncio grava", () => {
  const previa = ler("app/(dashboard)/dashboard/imoveis/novo/previa-tamanho-real.tsx");
  assert.match(previa, /<DestaquesImovel property=\{imovel\} \/>/);
  const pg = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const bloco = pg.slice(pg.indexOf("const previewProperty = {"), pg.indexOf("} as Property;", pg.indexOf("const previewProperty = {")));
  // Os mesmos campos que destaquesDoImovel lê na página pública.
  for (const campo of ["amenities:", "internetMbps:", "parkingSpots:", "proximities:", "readyToLiveBadge:", "tagHomeOffice:"]) assert.ok(bloco.includes(campo), campo);
});

test("E262 (a): a galeria aberta pinta na hora com a versão da miniatura (mesmo sizes) e pede a grande com prioridade", () => {
  const g = ler("components/property-gallery.tsx");
  const lightbox = g.slice(g.indexOf("function Lightbox("));
  assert.match(lightbox, /sizes=\{SIZES_MINIATURA\}/);
  assert.match(lightbox, /sizes="100vw" priority/);
  // As miniaturas do mosaico/carrossel usam o mesmo sizes — senão a URL muda e a de baixo não está no cache.
  assert.ok((g.match(/sizes=\{SIZES_MINIATURA\}/g) ?? []).length >= 3);
  assert.doesNotMatch(g, /sizes="\(max-width: 768px\) 100vw, 50vw"/);
});
