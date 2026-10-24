/*
  65-B na galeria (Pista A): o vídeo é o 2º item, logo depois da capa; o lightbox abre a foto certa pelo `fotoDoItem`.
  Roda: node --test src/components/property-gallery.video.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./property-gallery.tsx", import.meta.url), "utf8");

test("a galeria usa a lista com o vídeo depois da capa e o índice da foto pelo fotoDoItem", () => {
  assert.match(fonte, /const list = itensDaGaleriaVideoDepoisDaCapa\(fotos, videoUrl, !!videoArquivoId\);/);
  assert.match(fonte, /const foto = fotoDoItem\(list, i\);/);
  assert.doesNotMatch(fonte, /itensDaGaleria\(/, "a lista antiga (vídeo em 1º) saiu");
  assert.doesNotMatch(fonte, /temVideo \? i - 1/, "sem a conta antiga do índice");
  assert.match(fonte, /data-item="video"/);
});
