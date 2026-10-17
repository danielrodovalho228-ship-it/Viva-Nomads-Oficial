import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Ordem d1b76e6b (P0, Daniel 16/10): toda foto da galeria abre o lightbox na
 * própria posição, e nenhuma camada decorativa intercepta o clique.
 */
const src = readFileSync("src/components/property-gallery.tsx", "utf8");

test('"+N mais" abre na primeira foto oculta (índice 5), não na 1ª', () => {
  assert.match(src, /export const PRIMEIRA_FOTO_OCULTA = 5;/);
  const botao = src.match(/data-testid="galeria-mais"[\s\S]{0,200}/)?.[0] ?? "";
  assert.match(botao, /onOpen\(PRIMEIRA_FOTO_OCULTA\)/);
  assert.doesNotMatch(src, /onSeeAll/);
});

test('"Ver todas as N fotos" abre na 1ª foto', () => {
  const botao = src.match(/data-testid="galeria-ver-todas"[\s\S]{0,120}/)?.[0] ?? "";
  assert.match(botao, /onOpen\(0\)/);
});

test("selos e contador decorativos sobre a foto não interceptam o clique", () => {
  assert.match(src, /pointer-events-none absolute left-3 top-3[^"]*">\s*<ReadyToLiveBadge size="sm"/);
  assert.match(src, /pointer-events-none absolute left-4 top-4[^"]*">\s*<ReadyToLiveBadge \/>/);
  assert.match(src, /pointer-events-none absolute bottom-3 right-3/);
});

test("cada foto do mosaico e do carrossel tem tile clicável identificado", () => {
  assert.match(src, /testId="galeria-tile-0"/);
  assert.match(src, /testId=\{`galeria-tile-\$\{i \+ 1\}`\}/);
  assert.match(src, /testId=\{`galeria-tile-\$\{i\}`\}/);
});

test("\"+N mais\" é botão pequeno no canto: não cobre a miniatura da foto 5 (ordem a45eec8b)", () => {
  const botao = src.match(/data-testid="galeria-mais"[\s\S]{0,260}/)?.[0] ?? "";
  assert.doesNotMatch(botao, /absolute inset-0/);
  assert.doesNotMatch(botao, /bg-night/);
  assert.match(botao, /absolute (left|right)-\d+ (bottom|top)-\d/);
  assert.match(src, /testId=\{`galeria-tile-\$\{i \+ 1\}`\}[\s\S]{0,40}\/>\s*\{isLast/);
});
