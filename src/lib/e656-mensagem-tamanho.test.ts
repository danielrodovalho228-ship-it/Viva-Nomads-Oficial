/*
  E656 — o validador de documentos recusava o arquivo PEQUENO chamando-o de "documento válido/inválido" ("parece não ser
  um documento válido"). O tamanho não diz nada sobre o documento: a mensagem deve falar só do tamanho mínimo e do
  caminho (enviar um arquivo maior). Uma função só, nas três rotas de envio.
  Roda: node --test src/lib/e656-mensagem-tamanho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemArquivoPequeno, DOC_MIN_BYTES } from "./upload-limits.ts";

test("a mensagem fala só do tamanho mínimo e do caminho, sem rotular o documento", () => {
  const m = mensagemArquivoPequeno();
  assert.match(m, new RegExp(`${Math.round(DOC_MIN_BYTES / 1024)} KB`));
  assert.match(m, /maior/i);
  assert.doesNotMatch(m, /inválid|válid|parece não ser|documento/i);
});

for (const rota of ["inquilino-doc", "triagem-vinculo", "documento"]) {
  test(`rota ${rota}: usa a mensagem única e não rotula o documento`, () => {
    const src = readFileSync(new URL(`../app/api/upload/${rota}/route.ts`, import.meta.url), "utf8");
    assert.match(src, /mensagemArquivoPequeno\(\)/);
    assert.doesNotMatch(src, /parece não ser um documento/);
  });
}
