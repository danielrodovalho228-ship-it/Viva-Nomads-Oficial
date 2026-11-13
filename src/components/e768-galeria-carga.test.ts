/* Roda: node --test src/components/e768-galeria-carga.test.ts
  E768: o detalhe do anúncio abria com as fotos em branco (ube-001: 5 pendentes) e só carregava na 2ª leitura. Causa (no
  código): (1) as 4 fotos pequenas do mosaico pediam ao otimizador a versão da foto grande (sizes 50vw → 1080–1280 px
  para um quadro de ~300 px; cache frio = segundos de codificação cada); (2) as 4 fotos pequenas eram `eager` + prioridade
  alta mesmo dentro do mosaico `hidden md:block`, então no celular baixavam escondidas e disputavam a rede com a capa
  visível do carrossel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const g = readFileSync("src/components/property-gallery.tsx", "utf8");

test("E768: as fotos pequenas do mosaico pedem versão do tamanho do quadro (25vw; 34vw quando são 2–4 fotos)", () => {
  assert.match(g, /export const SIZES_MOSAICO_PEQUENA = "\(max-width: 768px\) 100vw, 25vw";/);
  assert.match(g, /export const SIZES_MOSAICO_COLUNA = "\(max-width: 768px\) 100vw, 34vw";/);
  assert.match(g, /sizes=\{sizes \?\? SIZES_MINIATURA\}/, "o quadro aceita sizes próprio e cai na miniatura grande");
  assert.match(g, /galeria-tile-\$\{i \+ 1\}`\} sizes=\{SIZES_MOSAICO_PEQUENA\}/);
  assert.match(g, /galeria-tile-\$\{i \+ 1\}`\} sizes=\{SIZES_MOSAICO_COLUNA\}/);
});

test("E768: só a capa tem prioridade alta; as fotos 2–5 do mosaico e as do carrossel pedem quando visíveis", () => {
  for (const linha of g.split("\n").filter((l) => l.includes("<Tile") && /galeria-tile-\$\{i \+ 1\}/.test(l))) {
    assert.doesNotMatch(linha, /\bprioridade\b/, "foto pequena do mosaico não leva prioridade (estava escondida no celular)");
  }
  assert.ok((g.match(/testId="galeria-tile-0" prioridade/g) ?? []).length >= 3, "a capa segue com prioridade nos 3 layouts do mosaico");
  assert.match(g, /prioridade=\{i === 0\}/, "no carrossel do celular só a 1ª");
});

test("E768: a galeria aberta continua reaproveitando a miniatura grande (E262)", () => {
  assert.match(g, /sizes=\{SIZES_MINIATURA\}/);
  assert.match(g, /sizes="100vw" priority/);
});
