/**
 * E513 (D-S2-09, A+B): cartões de anúncio sem foto e foto repetida em anúncios pausados.
 *  A — "sem foto": anúncio PAUSADO (ou ativo) cuja linha em property_photos aponta para arquivo que já saiu do bucket
 *      ficava sem capa, embora o draft_data tivesse foto real; a regra do E426 (cair na 1ª foto do draft_data) só valia
 *      para rascunho. Agora vale para qualquer status.
 *  B — "foto repetida": sem foto, coverPhoto() inventava uma do acervo (galleryRooms, pelo hash do id) — a MESMA foto
 *      em vários anúncios, e uma foto que não é do imóvel. Agora devolve null e a tela desenha o espaço sem foto.
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("A: a capa do draft_data vale para todo anúncio sem capa (pausado incluído), não só para rascunho", () => {
  const src = ler("lib/data/properties.ts");
  assert.match(src, /const semCapa = lista\.filter\(\(p\) => !\(p\.photos \?\? \[\]\)\.some\(ehUrlDeImagem\)\);/);
  assert.doesNotMatch(src, /lista\.filter\(\(p\) => p\.status === "draft" && !\(p\.photos/);
});

test("B: coverPhoto não inventa foto do acervo — sem foto do imóvel, null", async () => {
  const media = ler("lib/media.ts");
  const corpo = media.slice(media.indexOf("export function coverPhoto"), media.indexOf("}", media.indexOf("export function coverPhoto") + 200) + 1);
  assert.doesNotMatch(corpo, /galleryRooms/, "nada de foto do acervo como capa de imóvel");
  assert.match(media, /export function coverPhoto\(propertyId: string, photos\?: string\[\]\): string \| null/);
});

test("B: a lista 'Meus imóveis' do Início desenha o espaço sem foto quando não há capa", () => {
  const v = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.match(v, /const capa = coverPhoto\(p\.id, p\.photos\);/);
  assert.match(v, /capa \? \(\s*<Image\s+src=\{capa\}/);
  assert.match(v, /<PhotoPlaceholder className="h-14 w-14 shrink-0 rounded-xl"/);
});
