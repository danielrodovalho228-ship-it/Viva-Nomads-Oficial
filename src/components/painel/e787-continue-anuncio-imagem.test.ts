/* Roda: node --test src/components/painel/e787-continue-anuncio-imagem.test.ts — E787: a área da foto nunca fica em branco. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/components/painel/foto-inicio-dono.tsx", "utf8");
test("imagem que não pinta no prazo cai no plano B", () => {
  assert.match(s, /PRAZO_FOTO_MS = 8000/);
  assert.match(s, /setTimeout\(\(\) => setFalhou\(true\), PRAZO_FOTO_MS\)/);
});
test("onLoad com largura 0 também é falha; carregou real cancela o prazo", () => {
  assert.match(s, /onLoad=\{\(e\) =>/);
  assert.match(s, /naturalWidth === 0\) setFalhou\(true\);\s*\n\s*else setCarregou\(true\)/);
});
test("sem foto, rascunho mostra o espaço desenhado; sem rascunho, some", () => {
  assert.match(s, /inicio-dono-foto-vazia/);
  assert.match(s, /data-foto-falhou/);
});
